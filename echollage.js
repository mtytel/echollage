// Echollage - The Ech(o Nest C)ollage
// A dynamic grid of artist images and tracks developed using the Echo Nest API.
// Author: Matthew Tytel

var echollage = {};

// A nest.js wrapper to find similar tracks to a given focal artist.
// Set the focal artist using set_focal_artist.
// Call request_track to get track information from an artist similar to the
// focal artist.
echollage.collector = function() {
  var the_nest = nest.nest('UPLO3CALHCEZKZTTA');

  var similar_artist_ids = [];
  var active_request_id = null;

  var TRACKS_RESULTS = 30;
  var ARTIST_RESULTS = 100;
  var artist_position = 0;

  // Selects a track containing a |preview_url| and a |release_image| from
  // the Echo Nest track search results and returns them with the |artist_id|
  // and |artist_name|. If no valid tracks are found, returns null.
  function select_track(tracks) {
    while (tracks.length != 0) {
      var random_index = parseInt(Math.random() * tracks.length);
      var track_info = tracks[random_index];

      if (track_info.tracks.length > 0) {
        var track = track_info.tracks[0];

        if (track.preview_url && track.release_image) {
          return {
            artist_id: track_info.artist_id,
            artist_name: track_info.artist_name,
            preview_url: track.preview_url,
            release_image: track.release_image,
          };
        }
      }
      tracks.splice(random_index, 1);
    }
    return null;
  };

  // Makes request to the Echo Nest server requesting tracks for a queued
  // similar artist and returns a track object selected by |select_track|.
  var request_track = function(track_callback) {
    if (!the_nest || similar_artist_ids.length === 0) {
      console.log("The Echo Nest hasn't reponded :(");
      return;
    }

    var handle_tracks = function(error, tracks) {
      if (error) {
        console.log('Tracks request failed: ' + error);
        return;
      }
      track_callback(select_track(tracks));
    };

    var artist_id = similar_artist_ids[artist_position];
    artist_position = (artist_position + 1) % similar_artist_ids.length;

    var request_data = {
      artist_id: artist_id,
      results: TRACKS_RESULTS,
      bucket: ['id:7digital-US', 'tracks'],
    };
    the_nest.searchSongs(request_data, handle_tracks);
  };

  // Appends received artist ids to the similar artist queue.
  // Throws away old results because we don't want to actively return tracks
  // for the wrong artist.
  function handle_similar_artists(response_artist_id, error, results) {
    if (error) {
      console.log('Similar artists request failed: ' + error);
      return;
    }
    if (response_artist_id != active_request_id) {
      console.log('Received old similar artist results. Ignoring..');
      return;
    }

    similar_artist_ids = [];
    var artists = results.artists;
    for (i = 0; i < artists.length; ++i)
      similar_artist_ids.push(artists[i].id);
  };

  // Makes request to the Echo Nest server requesting artists similar to our
  // focal artist. Results are passed to |handle_similar_artists|.
  var set_focal_artist = function(artist_id) {
    if (!the_nest) {
      console.log("Echo Nest is not available :(");
      return;
    }
    active_request_id = artist_id;
    focal_artist_api = the_nest.artist({id: artist_id});

    var handler_wrapper = function(error, artists) {
      handle_similar_artists(artist_id, error, artists);
    };
    focal_artist_api.similar({results: ARTIST_RESULTS}, handler_wrapper);
  };

  return {
    set_focal_artist: set_focal_artist,
    request_track: request_track,
  };
}();

// A grid layout of similar artists to the focal artist.
// Clicking on an artist will set the new focal artist.
echollage.display = function() {
  var WIDTH = 6;
  var HEIGHT = 4;
  var current_focal_cell = null;
  var current_playing_cell = null;
  var last_loaded_cell = null;
  var update_position = 0;

  // This start up filling 'cuts off' edges of grid.
  // Rearrange for different effects.
  var update_order = function() {
    var positions = [];
    var n = 0, s = HEIGHT, e = WIDTH, w = 0;

    while (n < s && e > w) {
      // South side.
      for (c = e - 1; c >= w; --c)
        positions.push((s - 1) * WIDTH + c);
      s--;
      // North side.
      for (c = w; c < e; ++c)
        positions.push(n * WIDTH + c);
      n++;
      // East side.
      for (r = n; r < s; ++r)
        positions.push(r * WIDTH + (e - 1));
      e--;
      // West side.
      for (r = s - 1; r >= n; --r)
        positions.push(r * WIDTH + w);
      w++;
    }
    return positions;
  }();

  // Returns a list of numbers 1 to n shuffled.
  function shuffle(n) {
    var shuffled = [];
    for (i = 0; i < n; i++)
      shuffled.splice(parseInt((i + 1) * Math.random()), 0, i);
    return shuffled;
  };

  function get_cell_id(position) {
    return 'piece' + position;
  };

  function get_cell_by_position(position) {
    return document.getElementById(get_cell_id(position));
  };

  var init = function() {
    var echollage = document.getElementById('echollage');
    echollage.innerHTML = '';

    for (r = 0; r < WIDTH; ++r) {
      var row = document.createElement('ul');

      for (c = 0; c < HEIGHT; ++c) {
        var cell = document.createElement('li');
        cell.setAttribute('id', get_cell_id(r * HEIGHT + c));
        row.appendChild(cell);
      }
      echollage.appendChild(row);
    }
  };

  function get_next_cell() {
    var cell = get_cell_by_position(update_order[update_position++]);
    if (update_position >= update_order.length) {
      update_order = shuffle(WIDTH * HEIGHT);
      update_position = 0;
    }

    if (cell === current_focal_cell || cell === current_playing_cell)
      return get_next_cell();
    return cell;
  };

  function toggle(cell) {
    var audio = cell.getElementsByTagName('audio')[0];
    if (!audio) {
      console.log("Bad audio");
      return;
    }

    if (!audio.paused) {
      console.log("Not paused, pausing");
      audio.pause();
    }
    else {
      console.log("Paused, playing");
      if (current_playing_cell)
        current_playing_cell.getElementsByTagName('audio')[0].pause();
      audio.play();
    }
    current_playing_cell = cell;

    // If we aren't getting any new tracks, this will repeat the last track.
    // I'll consider this a feature.
    audio.addEventListener('ended', function() {
      toggle(last_loaded_cell);
    });
  };

  function new_cell_loaded(audio, image) {
    var cell = get_next_cell();
    cell.innerHTML = '';
    cell.appendChild(image);
    cell.appendChild(audio);

    last_loaded_cell = cell;
    image.onclick = function() {
      toggle(cell);
    };
  };

  var load_track = function(track) {
    var audio = new Audio()
    var image = new Image();

    var other_loaded = false;
    var component_loaded = function() {
      if (other_loaded)
        new_cell_loaded(audio, image);
      other_loaded = true;
    };

    audio.addEventListener('canplaythrough', component_loaded);
    image.onload = component_loaded;
    audio.src = track.preview_url;
    image.src = track.release_image;
  };

  return {
    init: init,
    load_track: load_track,
  };
}();

// The Update controller.
// Responsible for requesting tracks from the collector and sending results
// to the display.
echollage.updater = function() {
  var START_REQUEST_PERIOD = 500;
  var SETTLE_REQUEST_PERIOD = 3000;
  var HALF_LIFE = 10;
  var update_count = 0;

  // Sends a valid received track to the display.
  function handle_track(track) {
    if (track)
      echollage.display.load_track(track);
  };

  // Requests a new track from the collector.
  // Update speed trails off exponentially with half life |HALF_LIFE| from
  // |START_REQUEST_PERIOD| to |SETTLE_REQUEST_PERIOD|.
  function update() {
    echollage.collector.request_track(handle_track);
    var decay = Math.pow(0.5, update_count / HALF_LIFE);
    var wait = decay * START_REQUEST_PERIOD + (1 - decay) * SETTLE_REQUEST_PERIOD;
    setTimeout(update, wait);
    update_count++;
  };

  // Init everything and start requests.
  var start = function() {
    echollage.collector.set_focal_artist('AR6XZ861187FB4CECD');
    echollage.display.init();
    setTimeout(update, START_REQUEST_PERIOD);
  };

  return {
    start: start,
  };
}();

window.onload = echollage.updater.start;
