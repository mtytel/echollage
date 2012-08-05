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

// Echonest API static playlist requester.
// Call |get_playlist| to get a new static playlist based on an artist id.
echollage.playlist = function() {
  var REQUEST_TIMEOUT = 12000;
  var base_url = 'http://developer.echonest.com/api/v4/playlist/static';
  var default_data = {
    api_key: echollage.echo_nest_key,
    adventurousness: 1.0,
    bucket: ['id:7digital-US', 'tracks'],
    distribution: 'focused',
    dmca: true,
    format: 'jsonp',
    limit: true,
    results: 100,
    type: 'artist-radio',
    variety: 0.7
  };

  // Takes data returned from The Echo Nest and returns an array of track
  // objects with all need information.
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

  // Makes a static playlist request to The Echo Nest given |request_data|.
  function get_playlist(request_data, success_callback, error_callback) {
    var success_wrapper = function(data) {
      if (data.response && data.response.status.code === 0) {
        var playlist = extract_playlist(data);
        if (playlist) {
          success_callback(playlist);
          return;
        }
      }
      if (error_callback)
        error_callback("Couldn't find that artist.");
    };

    var error_wrapper = function() {
      error_callback('There was a problem reaching Echo Nest.');
    };

    jQuery.ajax({
      url: base_url,
      data: request_data,
      dataType: 'jsonp',
      success: success_wrapper,
      error: error_wrapper,
      timeout: REQUEST_TIMEOUT,
      traditional: true
    });
  }

  var get_playlist_by_name = function(focal_artist_name, success, error) {
    var data = jQuery.extend({artist: focal_artist_name}, default_data);
    get_playlist(data, success, error);
  };

  var get_playlist_by_id = function(focal_artist_id, success, error) {
    var data = jQuery.extend({artist_id: focal_artist_id}, default_data);
    get_playlist(data, success, error);
  };

  return {
    get_playlist_by_id: get_playlist_by_id,
    get_playlist_by_name: get_playlist_by_name
  };
}();

// A grid layout of similar artists to the focal artist.
// Clicking on an artist will set the new focal artist.
echollage.collage = function() {
  var WIDTH = 6;
  var HEIGHT = 4;
  var MAX_ARTIST_TRACKS = 2;

  var active_id = null;
  var hovering_id = null;
  var last_loaded_id = null;
  var update_position = 0;
  var artist_tracks = {};

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

  // Computes integer position based on grid coordinates.
  function compute_position(r, c) {
    return r * WIDTH + c;
  }

  // Returns a list of numbers 1 to n shuffled.
  function shuffle(n) {
    var shuffled = [];
    for (var i = 0; i < n; i++)
      shuffled.splice(parseInt((i + 1) * Math.random(), 10), 0, i);
    return shuffled;
  }

  function get_cell_id(position) {
    return 'cell' + position;
  }

  function get_cell_css_id(position) {
    return '#' + get_cell_id(position);
  }

  // Sets up the base html to load images and buttons into.
  var init = function() {
    var collage = jQuery('#echollage').html('');
    for (var r = 0; r < HEIGHT; ++r) {
      var row = jQuery('<ul></ul>');

      for (var c = 0; c < WIDTH; ++c) {
        var cell_id = get_cell_id(compute_position(r, c));
        row.append(jQuery('<li></li>').attr('id', cell_id));
      }
      collage.append(row);
    }
  };

  // Returns the cell DOM node to we will replace next.
  function get_next_id() {
    var id = get_cell_css_id(update_order[update_position]);
    update_position++;
    if (update_position >= update_order.length) {
      update_order = shuffle(WIDTH * HEIGHT);
      update_position = 0;
    }

    if (id === hovering_id || id === active_id)
      return get_next_id();
    return id;
  }

  // Plays a cell DOM node by starting audio and changing any UI elements.
  function play(id) {
    var cell = jQuery(id);
    if (id !== active_id)
      echollage.controller.set_focal_artist(cell.attr('artist_id'));

    if (active_id)
      pause(active_id);
    soundManager.play(cell.attr('track_id'));

    active_id = id;
    cell.children('.border').show();
    cell.children('.play').addClass('playing');
  }

  // Pauses a cell DOM node by pausing audio and changing any UI elements.
  function pause(id) {
    var cell = jQuery(id);
    soundManager.pause(cell.attr('track_id'));
    cell.children('.border').hide();
    cell.children('.play').removeClass('playing');
  }

  // If a cell DOM node is paused we will play, and if playing we will pause.
  function toggle(id) {
    var cell = jQuery(id);
    var audio = soundManager.getSoundById(cell.attr('track_id'));
    if (audio.playState === 0 || audio.paused)
      play(id);
    else
      pause(id);
  }

  function create_album_art_div() {
    return jQuery('<div></div>').addClass('album-art');
  }

  function create_play_button() {
    return jQuery('<div></div>').addClass('overlay play');
  }

  function create_active_border() {
    return jQuery('<div></div>').addClass('border');
  }

  function create_track_info_box(track_data) {
    return jQuery('<div></div>').addClass('overlay track-info')
           .append(jQuery('<p>' + track_data.artist_name + '</p>'))
           .append(jQuery('<p>' + track_data.title + '</p>'));
  }

  function free_sound(id) {
    var cell = jQuery(id);
    var track_id = cell.attr('track_id');
    var artist_id = cell.attr('artist_id');

    if (track_id) {
      soundManager.destroySound(track_id);
      delete artist_tracks[artist_id][track_id];
      if (Object.keys(artist_tracks[artist_id]).length === 0)
        delete artist_tracks[artist_id];
    }
  }

  function replace_track_info_box(id, track) {
    var cell = jQuery(id);
    cell.children('.track-info').remove();
    cell.append(create_track_info_box(track));
  }

  function replace_album_art(id, image) {
    var cell = jQuery(id);
    var old_image = cell.children('img');
    cell.append(image.hide());
    image.fadeIn('slow', function() {
      old_image.remove();
    });
  }

  function init_cell(id, track) {
    jQuery(id).append(create_active_border())
              .append(create_track_info_box(track))
              .append(create_play_button())
              .hover(function() { hovering_id = id; })
              .click(function() { toggle(id); });
  }

  // Places successfully loaded audio and image on the grid and adds click
  // events.
  function place_loaded_data(track, image) {
    var id = get_next_id();
    var cell = jQuery(id);

    free_sound(id);
    cell.attr('artist_id', track.artist_id);
    cell.attr('track_id', track.id);

    if (cell.children('img').size() === 0)
      init_cell(id, track);
    replace_album_art(id, image);
    replace_track_info_box(id, track);

    if (!artist_tracks[track.artist_id])
      artist_tracks[track.artist_id] = {};

    artist_tracks[track.artist_id][track.id] = track;
    last_loaded_id = id;
  }

  // Accepts track data and will attempt to load the audio and image within.
  // If it succeeds, we will place the image on the grid.
  var place_track = function(track) {
    var image = jQuery('<img />').attr('src', track.release_image);
    var on_media_ready = echollage.on_multiple_ready(2, function() {
      place_loaded_data(track, image);
    });

    image.load(on_media_ready);
    soundManager.createSound({
      id: track.id,
      url: track.preview_url,
      autoLoad: true,
      onload: function(success) {
        if (success)
          on_media_ready();
      },
      onfinish: function() {
        play(last_loaded_id);
      }
    });
  };

  // Checks if we should display the given track or not based on what is
  // currently in the collage.
  var should_display = function(track) {
    if (!track)
      return false;
    if (!artist_tracks[track.artist_id])
      return true;
    return Object.keys(artist_tracks[track.artist_id]) < MAX_ARTIST_TRACKS &&
           artist_tracks[track.artist_id][track.id];
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

// Collects playlists and slowly sends the results to the display.
// Accepts change of focal artist.
echollage.controller = function() {
  var update_period = echollage.exponential_decay(500, 4000, 10);
  var playlist = [];
  var update_timeout = null;

  function update() {
    var track = playlist.shift();
    while (track && !echollage.collage.should_display(track))
      track = playlist.shift();
    if (echollage.collage.should_display(track))
      echollage.collage.place_track(track);
    update_timeout = setTimeout(update, update_period.next());
  }

  // Receives a playlist and if it's valid will begin updates.
  var handle_playlist = function(result_playlist) {
    if (!result_playlist || result_playlist.length === 0)
      return;
    if (update_timeout)
      clearTimeout(update_timeout);
    playlist = result_playlist;
    update();
  };

  var set_focal_artist = function(focal_artist_id) {
    echollage.playlist.get_playlist_by_id(focal_artist_id, handle_playlist);
  };

  function start(initial_playlist) {
    playlist = initial_playlist;
    echollage.collage.init();
    update();
  }

  return {
    set_focal_artist: set_focal_artist,
    start: start
  };
}();

// The initial display, will look up an artist for the first playlist.
echollage.startup = function() {
  var TEXT_FADE_OUT = 1000;

  function enter() {
    var success = function(playlist) {
      jQuery('.status').text("Let's do it!");
      jQuery('#artist_entry').fadeOut(TEXT_FADE_OUT, function() {
        echollage.controller.start(playlist);
      });
    };

    var error = function(message) {
      jQuery('#artist_name').removeAttr('disabled').focus();
      jQuery('#artist_spinner').fadeOut();
      jQuery('.status').text(message);
    };

    var artist_name = jQuery('#artist_name').val();
    echollage.playlist.get_playlist_by_name(artist_name, success, error);
    jQuery('.status').text('Searching...');
    jQuery('#artist_name').attr('disabled', true).blur();
    jQuery('#artist_spinner').fadeIn();
  }

  var ready = function() {
    jQuery('#artist_name').removeAttr('disabled');
    jQuery('#artist_name').keypress(function(e) {
      if(e.which == 13)
        enter();
    });
  };

  return {
    ready: ready
  };
}();

// Support for browsers that don't like cross site scripting.
jQuery.support.cors = true;

// Once the soundManager and window load, call echollage.startup.ready.
echollage.ready = echollage.on_multiple_ready(2, echollage.startup.ready);

soundManager.setup({
  url: '/SoundManager2/swf/',
  onready: echollage.ready
});
window.onload = echollage.ready;
