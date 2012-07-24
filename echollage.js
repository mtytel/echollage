// Echollage - The Ech(o Nest C)ollage
// A dynamic grid of artist images and tracks developed using the Echo Nest API.
// Written by Matthew Tytel in Linnaea's Cafe, San Luis Obispo, CA.

var echollage = {};
echollage.nest = nest.nest('UPLO3CALHCEZKZTTA');

soundManager.setup({
  url: 'SoundManager2/swf/',
  onready: function() { },
});
// Creates a function where when called |number| times, will call |callback|.
echollage.on_multiple_ready = function(number, callback) {
  return function() {
    number--;
    if (number <= 0)
      callback();
  };
};

// A nest.js wrapper to find similar tracks to a given focal artist.
// Call request_track to get track information from an artist similar to the
// focal artist.
echollage.collector = function(focal_artist_id, ready_callback) {
  if (!echollage.nest) {
    console.log("Echo Nest is not available :(");
    return null;
  }

  var similar_artist_ids = [];
  var TRACKS_RESULTS = 30;
  var ARTIST_RESULTS = 100;
  var artist_position = 0;

  // Make a request to the Echo Nest server for artists similar to our
  // focal artist. Result ids are stored and the ready callback is ran.
  var focal_artist_api = echollage.nest.artist({id: focal_artist_id});
  focal_artist_api.similar({results: ARTIST_RESULTS}, function(error, results) {
    if (error || results.artists.length === 0) {
      console.log("Similar artists request failed: " + error);
      return;
    }
    var artists = results.artists;
    for (var i = 0; i < artists.length; ++i)
      similar_artist_ids.push(artists[i].id);
    if (ready_callback)
      ready_callback();
  });

  // Selects a track containing a |preview_url| and a |release_image| from
  // the Echo Nest track search results and returns them with the |artist_id|
  // and |artist_name|. If no valid tracks are found, returns null.
  function select_track(tracks) {
    while (tracks.length != 0) {
      var random_index = parseInt(Math.random() * tracks.length, 10);
      var track_info = tracks[random_index];

      if (track_info.tracks.length > 0) {
        var track = track_info.tracks[0];

        if (track.preview_url && track.release_image) {
          return {
            title: track_info.title,
            artist_id: track_info.artist_id,
            artist_name: track_info.artist_name,
            preview_url: track.preview_url,
            release_image: track.release_image
          };
        }
      }
      tracks.splice(random_index, 1);
    }
    return null;
  }

  // Makes request to the Echo Nest server for tracks of a similar artist
  // and returns a track object selected by |select_track|.
  var request_track = function(track_callback) {
    if (similar_artist_ids.length === 0) {
      console.log("The Echo Nest hasn't reponded :(");
      return;
    }

    var handle_tracks = function(error, tracks) {
      if (error) {
        console.log("Tracks request failed: " + error);
        return;
      }
      track_callback(select_track(tracks));
    };

    var artist_id = similar_artist_ids[artist_position];
    artist_position = (artist_position + 1) % similar_artist_ids.length;

    var request_data = {
      artist_id: artist_id,
      results: TRACKS_RESULTS,
      bucket: ['id:7digital-US', 'tracks']
    };
    echollage.nest.searchSongs(request_data, handle_tracks);
  };

  return {
    request_track: request_track
  };
};

// A grid layout of similar artists to the focal artist.
// Clicking on an artist will set the new focal artist.
echollage.display = function() {
  var WIDTH = 6;
  var HEIGHT = 4;
  var current_focal_cell = null;
  var current_active_cell = null;
  var current_hovering_cell = null;
  var last_loaded_cell = null;
  var update_position = 0;

  // Computes integer position based on grid coordinates.
  function compute_position(r, c) {
    return r * WIDTH + c;
  }

  // This is a spiral starting from the top right, traveling clockwise.
  // Rearrange for different effects.
  var update_order = function() {
    var positions = [];
    var north = 0, south = HEIGHT, east = WIDTH, west = 0, r = 0, c = 0;
    while (north < south && east > west) {
      // East side.
      for (r = north; r < south; ++r)
        positions.push(compute_position(r, east - 1));
      east--;
      // South side.
      for (c = east - 1; c >= west; --c)
        positions.push(compute_position(south - 1, c));
      south--;
      // West side.
      for (r = south - 1; r >= north; --r)
        positions.push(compute_position(r, west));
      west++;
      // North side.
      for (c = west; c < east; ++c)
        positions.push(compute_position(north, c));
      north++;
    }
    return positions;
  }();

  // Returns a list of numbers 1 to n shuffled.
  function shuffle(n) {
    var shuffled = [];
    for (var i = 0; i < n; i++)
      shuffled.splice(parseInt((i + 1) * Math.random(), 10), 0, i);
    return shuffled;
  }

  // Gets cell id for DOM.
  function get_cell_id(position) {
    return 'piece' + position;
  }

  // Returns DOM node for cell positions.
  function get_cell_by_position(position) {
    return document.getElementById(get_cell_id(position));
  }

  // Sets up the base html to load images and audio into.
  var init = function() {
    var echollage_dom = document.getElementById('echollage');
    echollage_dom.innerHTML = '';

    for (var r = 0; r < WIDTH; ++r) {
      var row = document.createElement('ul');

      for (var c = 0; c < HEIGHT; ++c) {
        var cell = document.createElement('li');
        cell.setAttribute('id', get_cell_id(r * HEIGHT + c));
        row.appendChild(cell);
      }
      echollage_dom.appendChild(row);
    }
  };

  // Returns the cell DOM node to replace next.
  function get_next_cell() {
    var cell = get_cell_by_position(update_order[update_position]);
    update_position++;
    if (update_position >= update_order.length) {
      update_order = shuffle(WIDTH * HEIGHT);
      update_position = 0;
    }

    if (cell === current_focal_cell || cell === current_active_cell ||
        cell === current_hovering_cell) {
      return get_next_cell();
    }
    return cell;
  }

  // Will switch the audio in a cell from playing to paused and vice versa.
  // If a new cell was clicked on, we will ask the updater to look for artists
  // similar to the on clicked on.
  function toggle(cell) {
    var audio = cell.getElementsByTagName('audio')[0];

    if (!audio.paused) {
      audio.pause();
      cell.getElementsByClassName('border')[0].style.visibility = 'hidden';
    }
    else {
      if (cell !== current_active_cell) {
        var artist_id = cell.getAttribute('artist_id');
        echollage.updater.set_focal_artist(artist_id);
      }
      if (current_active_cell)
        current_active_cell.getElementsByTagName('audio')[0].pause();

      audio.play();
      current_active_cell = cell;
      cell.getElementsByClassName('border')[0].style.visibility = 'visible';
    }
  }

  function create_play_button() {
    var play = document.createElement('div');
    play.setAttribute('class', 'overlay play');
    return play;
  }

  function create_active_border() {
    var active_border = document.createElement('div');
    active_border.setAttribute('class', 'border');
    return active_border;
  }

  function create_track_info_box(track_data) {
    var track_info = document.createElement('div');
    track_info.setAttribute('class', 'overlay track-info');

    var artist_name = document.createElement('p');
    artist_name.textContent = track_data.artist_name;
    track_info.appendChild(artist_name);

    var track_title = document.createElement('p');
    track_title.textContent = track_data.title;
    track_info.appendChild(track_title);
    return track_info;
  }

  // Places successfully loaded audio and image on the grid and adds click
  // events.
  function place_loaded_data(track, audio, image) {
    var cell = get_next_cell();
    cell.innerHTML = '';
    cell.setAttribute('artist_id', track.artist_id);
    cell.appendChild(audio);
    cell.appendChild(image);
    cell.appendChild(create_active_border());
    cell.appendChild(create_track_info_box(track));

    image.onmouseover = function() {
      current_hovering_cell = cell;
    };

    var play_button = create_play_button();
    play_button.onclick = function() {
      toggle(cell);
    };
    cell.appendChild(play_button);
    last_loaded_cell = cell;
  }

  // Accepts track data and will attempt to load the audio and image within.
  // If it succeeds, we will place the image on the grid.
  var place_track = function(track) {
    var audio = new Audio();
    var image = new Image();

    var other_loaded = false;
    var on_media_ready = echollage.on_multiple_ready(2, function() {
      place_loaded_data(track, audio, image);
    });

    image.src = track.release_image;
    image.onload = on_media_ready;
    audio.src = track.preview_url;
    audio.addEventListener('canplaythrough', on_media_ready);

    audio.addEventListener('ended', function() {
      toggle(last_loaded_cell);
    });
  };

  return {
    init: init,
    place_track: place_track
  };
}();

// Computes discrete exponential decays from one value to another.
// Value converges using |half_life|.
echollage.exponential_decay = function(from, to, half_life) {
  var count = 0;
  var next = function() {
    var decay = Math.pow(0.5, count / half_life);
    count++;
    return decay * from + (1 - decay) * to;
  };

  return {
    next: next
  };
};

// The Update controller.
// Responsible for requesting tracks from the collector and sending results
// to the display.
echollage.updater = function() {
  var update_period = echollage.exponential_decay(500, 3000, 10);
  var update_timeout = null;
  var collector = null;

  // Sends a valid received track to the display.
  function handle_track(track) {
    if (track)
      echollage.display.place_track(track);
  }

  // Requests a new track from the collector.
  function update() {
    collector.request_track(handle_track);
    update_timeout = setTimeout(update, update_period.next());
  }

  // Sets up a new Echo Nest collector for the new artist.
  // Cancels any updates because we need to wait for the new artists.
  var set_focal_artist = function(focal_artist_id) {
    if (update_timeout)
      clearTimeout(update_timeout);
    collector = echollage.collector(focal_artist_id, update);
  };

  // Init everything and start requests.
  var start = function() {
    var on_ready = echollage.on_multiple_ready(1, update);
    collector = echollage.collector('AR6XZ861187FB4CECD', on_ready);
    echollage.display.init();
  };

  return {
    set_focal_artist: set_focal_artist,
    start: start
  };
}();

window.onload = echollage.updater.start;
