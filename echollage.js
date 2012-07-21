// Echollage - The Ech(o Nest C)ollage
// A dynamic grid of artist images and tracks developed using the Echo Nest API.
// Author: Matthew Tytel

var echollage = {};

// A nest.js wrapper to find similar tracks to a given base artist.
// Set the base artist using set_base_artist.
// Call request_track to get track information from an artist similar to the
// base artist.
echollage.collector = function() {
  var the_nest = nest.nest('ZGEHXS9DI7KNKZOQR');

  var similar_artist_ids = [];
  var base_artist_api = null;

  var TRACKS_RESULTS = 30;
  var ARTIST_RESULTS = 15;
  var MAX_ARTISTS = 100;
  var LOW_ARTIST_THRESHOLD = 5;
  var artist_start_position = 0;

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

  // Makes request to the Echo Nest server requesting tracks for an queued
  // similar artist and returns a track object selected by |select_track|.
  // Requests more similar artists if we're running low.
  var request_track = function(track_callback) {
    if (!the_nest) {
      console.log("Echo Nest is not available:(");
      return;
    }
    if (similar_artist_ids.length === 0) {
      console.log('There are no similar artists to pull from.');
      return;
    }

    var handle_tracks = function(error, tracks) {
      if (error) {
        console.log('Tracks request failed: ' + error);
        return;
      }
      track_callback(select_track(tracks));
    };

    var artist_id = similar_artist_ids.shift();
    var request_data = {
      artist_id: artist_id,
      results: TRACKS_RESULTS,
      bucket: ['id:7digital-US', 'tracks'],
    };

    the_nest.searchSongs(request_data, handle_tracks);
    if (similar_artist_ids.length < LOW_ARTIST_THRESHOLD)
      request_more_artists();
  };

  // Appends received artist ids to the similar artist queue.
  // Throws away old results because we don't want to actively return tracks
  // for the wrong artist.
  function handle_similar_artists(requested_artist_id, error, results) {
    if (error) {
      console.log('Similar artists request failed: ' + error);
      return;
    }
    if (requested_artist_id != base_artist_api.id) {
      console.log('Received old similar artist results. Ignoring..');
      return;
    }

    var artists = results.artists;
    for (i = 0; i < artists.length; ++i)
      similar_artist_ids.push(artists[i].id);
  };

  // Makes request to the Echo Nest server requesting artists similar to our
  // base artist. Results are passed to |handle_similar_artists|.
  function request_more_artists() {
    var current_id = base_artist_api.id;
    var handler_wrapper = function(error, artists) {
      handle_similar_artists(current_id, error, artists);
    };

    var results = Math.min(ARTIST_RESULTS, MAX_ARTISTS - artist_start_position);
    var request_data = {
      results: results,
      start: artist_start_position,
    };

    base_artist_api.similar(request_data, handler_wrapper);
    artist_start_position = (artist_start_position + results) % MAX_ARTISTS;
  };

  // Sets the base artist. New |request_track| calls will return tracks from
  // artists that are similar to the artist represented by |artist_id|.
  var set_base_artist = function(artist_id) {
    if (!the_nest) {
      console.log("Echo Nest is not available:(");
      return;
    }
    similar_artist_ids = [];
    artist_start_position = 0;
    base_artist_api = the_nest.artist({id: artist_id});
    request_more_artists();
  };

  return {
    set_base_artist: set_base_artist,
    request_track: request_track,
  };
}();

// A grid layout of similar artists to the base artist.
// Clicking on an artist will set the new base artist.
echollage.display = function() {
  var WIDTH = 6;
  var HEIGHT = 4;
  var current_playing = null;

  function cell_id(position) {
    return 'piece' + position;
  };

  var init_html = function() {
    var echollage_elements = document.getElementById('echollage');
    for (r = 0; r < WIDTH; ++r) {
      var row = document.createElement('ul');

      for (c = 0; c < HEIGHT; ++c) {
        var cell = document.createElement('li');
        cell.setAttribute('id', cell_id(r * HEIGHT + c));
        row.appendChild(cell);
      }
      echollage_elements.appendChild(row);
    }
  };

  var replace_next = function(track) {
    var next = parseInt(Math.random() * WIDTH * HEIGHT);
    cell = document.getElementById(cell_id(next));

    var audio = new Audio()
    var image = new Image();

    // TODO: Refactor this real good.
    var image_loaded = false;
    var audio_loaded = false;

    console.log("Loading: " + track.preview_url);
    function draw() {
      if (cell.childNodes[0])
        cell.removeChild(cell.childNodes[0]);
      cell.appendChild(image);
      if (current_playing)
        current_playing.pause();
      current_playing = audio;
      audio.play();
    };
    audio.addEventListener('canplaythrough', function() {
      if (image_loaded)
        draw();
      audio_loaded = true;
      console.log("audio loaded");
    });
    image.onload = function() {
      if (audio_loaded)
        draw();
      image_loaded = true;
      console.log("image loaded");
    };

    audio.src = track.preview_url;
    image.src = track.release_image;
  };

  return {
    init_html: init_html,
    replace_next: replace_next,
  };
}();

// Update controller.
echollage.updater = function() {

  var start = function() {
    echollage.display.init_html();
    echollage.collector.set_base_artist('AR6XZ861187FB4CECD');
  };

  function handle_track(track) {
    if (track)
      echollage.display.replace_next(track);
  };

  var request_track = function() {
    echollage.collector.request_track(handle_track);
  };

  return {
    start: start,
    request_track: request_track,
  };
}();

window.onload = echollage.updater.start;

