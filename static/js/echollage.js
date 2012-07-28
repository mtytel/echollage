// Echollage - The Ech(o Nest C)ollage
// A dynamic grid of artist images and tracks developed using the Echo Nest API.
// Written by Matthew Tytel in Linnaea's Cafe, San Luis Obispo, CA.

var echollage = {};
echollage.echo_nest_key = 'UPLO3CALHCEZKZTTA';

// Creates a function that when called |number| times, will call |callback|.
echollage.on_multiple_ready = function(number, callback) {
  return function() {
    number--;
    if (number === 0)
      callback();
  };
};

echollage.playlist = function() {
  var base_url = 'http://developer.echonest.com/api/v4/playlist/static';
  var request_data = {
    api_key: echollage.echo_nest_key,
    adventurousness: 1.0,
    bucket: ['id:7digital-US', 'tracks'],
    distribution: 'focused',
    dmca: true,
    limit: true,
    results: 100,
    type: 'artist-radio',
    variety: 1.0
  };

  function extract_playlist(data) {
    var tracks = [];
    var songs = data.response.songs;
    for (var i = 0; i < songs.length; ++i) {
      var song = songs[i];
      var track = song.tracks[0];
      tracks.push({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
        preview_url: track.preview_url,
        release_image: track.release_image
      });
    }
    return tracks;
  }

  var get_playlist = function(focal_artist_id, callback) {
    request_data.artist_id = focal_artist_id;
    var callback_wrapper = function(data) {
      if (data.response && data.response.status.code === 0)
        callback(extract_playlist(data));
      else
        console.log('Error retrieving a playlist.');
    };
    jQuery.ajax({
      url: base_url,
      data: request_data,
      dataType: 'json',
      success: callback_wrapper,
      traditional: true
    });
  };

  return {
    get_playlist: get_playlist
  };
}();

// A grid layout of similar artists to the focal artist.
// Clicking on an artist will set the new focal artist.
echollage.collage = function() {
  var WIDTH = 6;
  var HEIGHT = 4;
  var focal_cell = null;
  var active_cell = null;
  var hovering_cell = null;
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

    if (cell === focal_cell || cell === active_cell ||
        cell === hovering_cell) {
      return get_next_cell();
    }
    return cell;
  }

  function play(cell) {
    if (cell !== active_cell)
      echollage.controller.set_focal_artist(cell.getAttribute('artist_id'));

    if (active_cell)
      pause(active_cell);
    soundManager.play(cell.getAttribute('track_id'));
    active_cell = cell;
    cell.getElementsByClassName('border')[0].style.visibility = 'visible';
    cell.getElementsByClassName('play')[0].classList.add('playing');
  }

  function pause(cell) {
    soundManager.pause(cell.getAttribute('track_id'));
    cell.getElementsByClassName('border')[0].style.visibility = 'hidden';
    cell.getElementsByClassName('play')[0].classList.remove('playing');
  }

  // Will switch the audio in a cell from playing to paused and vice versa.
  // If a new cell was clicked on, we will ask the controller to look for
  // artists similar to the on clicked on.
  function toggle(cell) {
    var audio = soundManager.getSoundById(cell.getAttribute('track_id'));
    if (audio.playState === 0 || audio.paused)
      play(cell);
    else
      pause(cell);
  }

  function create_play_button() {
    var play_button = document.createElement('div');
    play_button.setAttribute('class', 'overlay play');
    return play_button;
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
  function place_loaded_data(track, image) {
    var cell = get_next_cell();
    cell.innerHTML = '';
    cell.setAttribute('artist_id', track.artist_id);
    cell.setAttribute('track_id', track.id);

    cell.appendChild(image);
    cell.appendChild(create_active_border());
    cell.appendChild(create_track_info_box(track));

    image.onmouseover = function() {
      hovering_cell = cell;
    };

    var play_button = create_play_button();
    play_button.onclick = function() {
      toggle(cell);
    };
    cell.appendChild(play_button);
    last_loaded_cell = cell;
  }

  var should_display = function(track) {
    if (track)
      return true;
    return false;
  };

  // Accepts track data and will attempt to load the audio and image within.
  // If it succeeds, we will place the image on the grid.
  var place_track = function(track) {
    var image = new Image();
    var on_media_ready = echollage.on_multiple_ready(2, function() {
      place_loaded_data(track, image);
    });

    image.src = track.release_image;
    image.onload = on_media_ready;

    soundManager.createSound({
      id: track.id,
      url: track.preview_url,
      autoLoad: true,
      onload: function(success) {
        if (success)
          on_media_ready();
      },
      onfinish: function() {
        play(last_loaded_cell);
      }
    });
  };

  return {
    init: init,
    place_track: place_track,
    should_display: should_display
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

echollage.controller = function() {
  var update_period = echollage.exponential_decay(500, 4000, 10);
  var playlist = [];
  var update_timeout = null;

  function update() {
    var track = playlist.shift();
    if (echollage.collage.should_display(track))
      echollage.collage.place_track(track);
    update_timeout = setTimeout(update, update_period.next());
  }

  var handle_playlist = function(result_playlist) {
    if (!result_playlist || result_playlist.length == 0)
      return;
    if (update_timeout)
      clearTimeout(update_timeout);
    playlist = result_playlist;
    update();
  };

  var set_focal_artist = function(focal_artist_id) {
    echollage.playlist.get_playlist(focal_artist_id, handle_playlist);
  };

  function start(artist_id) {
    echollage.collage.init();
    set_focal_artist(artist_id);
  }

  return {
    set_focal_artist: set_focal_artist,
    start: start
  };
}();

echollage.startup = function() {
  var TEXT_FADE_OUT = 200;
  var base_url = 'http://developer.echonest.com/api/v4/artist/profile';

  var ready = function() {
    jQuery('#artist_name').watermark('Enter an Artist')
                          .removeAttr('disabled').focus();
  };

  var enter = function() {
    var callback = function(data) {
      var response = data.response;
      if (response && response.status.code === 0) {
        jQuery('#artist_name').fadeOut(TEXT_FADE_OUT, function() {
          echollage.controller.start(response.artist.id);
        });
      }
      else
        jQuery('#artist_name').removeAttr('disabled').focus();
    };

    var artist_name = jQuery('#artist_name').val();
    jQuery('#artist_name').attr('disabled', true).blur();
    var request_data = {
      api_key: echollage.echo_nest_key,
      name: artist_name
    };
    jQuery.get(base_url, request_data, callback);
  };

  return {
    enter: enter,
    ready: ready
  };
}();

// Once the soundManager and the window load, call echollage.startup.ready.
echollage.ready = echollage.on_multiple_ready(2, echollage.startup.ready);

soundManager.setup({
  url: '/SoundManager2/swf/',
  onready: echollage.ready
});
window.onload = echollage.ready;
