var async = require('async')
  , _ = require('underscore')
  , util = require('../util');

module.exports = {
  list: function(req, res, next) {
    var limit = (req.param('limit')) ? parseInt(req.param('limit')) : 100;
    var skip = (req.param('skip')) ? parseInt(req.param('skip')) : 0;
    var query = (req.param('q')) ? { name: new RegExp('(.*)'+req.param('q')+'(.*)', 'i') } : {};

    if (req.param('nsfw') === '✓') {
      query.flags = {
        nsfw: true
      }
    }
    if (req.param('live') === '✓') {
      query.flags = {
        live: true
      }
    }

    /*/Play.aggregate([
      { $group: { _id: '$_track', count: { $sum: 1 } } },
      { $sort: { 'count': -1 } },
      { $limit: limit }
    ], function(err, tracks) {
      if (err) { console.log(err); }/**/

      //Track.find({ _id: { $in: tracks.map(function(x) { return x._id; }) }}).populate('_artist').exec(function(err, tracks) {
      Track.find( query ).populate('_artist').limit( limit ).skip(skip).exec(function(err, tracks) {
        if (err) { console.log(err); }

        Track.count( query ).exec(function(err, count) {
          if (err) { console.log(err); }
          
          res.format({
            json: function() {
              res.send( tracks );
            },
            html: function() {
              res.render('tracks', {
                  tracks: tracks
                , count: count
                , limit: limit
                , skip: skip
                , query: query
              });
            }
          });
        });
      });
    /*/});/**/
  },
  delete: function(req, res, next) {
	Track.remove({ _id: req.param('trackID')}).exec(function(err,track) {
		if(err) {
			console.log("error deleting track" + err);
		} else {
			console.log("deleted" +  req.param('trackID'));
		}
	});
  },
  pool: function(req, res, next) {
    var query = { _curator: { $exists: true } };

    query = _.extend( query , {
      $or: util.timeSeries('timestamp', 3600*3*1000, 24*60*1000*60, 7),
      timestamp: { $lt: (new Date()) - 3600 * 3 * 1000 }
    });

    Play.find( query ).limit(4096).exec(function(err, plays) {
      Track.find({ _id: { $in: plays.map(function(x) { return x._track; }) } }).populate('_artist _credits').exec(function(err, tracks) {
        res.format({
          json: function() {
            res.send( tracks );
          },
          html: function() {
            res.render('pool', {
                tracks: tracks
              , query: query
            });
          }
        });
      });
    });
  },
  edit: function(req, res, next) {

    if (!req.param('artistName') || !req.param('title')) {

      if (['true', 'false'].indexOf( req.param('nsfw') ) >= 0 ) {
        Track.findOne({ _id: req.param('trackID') }).populate('_artist').exec(function(err, track) {
          if (!track) { return next(); }

          track.flags.nsfw = req.param('nsfw');
          track.save(function(err) {
            res.send({
                status: 'success'
              , message: 'Track edited successfully.'
            });

            req.soundtrack.broadcast({
                type: 'edit'
              , track: track
            });

          });
        });
      } else if (['true', 'false'].indexOf( req.param('live') ) >= 0 ) {
        Track.findOne({ _id: req.param('trackID') }).populate('_artist').exec(function(err, track) {
          if (!track) { return next(); }

          track.flags.live = req.param('live');
          track.save(function(err) {
            res.send({
                status: 'success'
              , message: 'Track edited successfully.'
            });

            req.soundtrack.broadcast({
                type: 'edit'
              , track: track
            });

          });
        });
      } else {
        res.send({
            status: 'error'
          , message: 'Required parameters not specified.'
        });
      }
    } else {
      // parse the submitted values (which may or may not yet exist in the database)
      var stringToParse = req.param('artistName') + ' - ' + req.param('title');
      util.parseTitleString( stringToParse , function(parts) {
        console.log('edited track, parsed parts into: ')
        console.log(parts);

        // find the edited track...
        Track.findOne({ _id: req.param('trackID') }).exec(function(err, track) {
          if (err || !track) { return next(); }

          // get the artist parsed from the new artist name...
          Artist.findOne({ name: parts.artist }).exec(function(err, artist) {
            if (err) { console.log(err); }

            if (!artist ) { var artist = new Artist({ name: req.param('artistName') }); }

            // go ahead and issue a save for it (so it exists when we save the track)
            artist.save(function(err) {
              if (err) { console.log(err); }

              // find a list of artists in the parsed credits...
              Artist.find({ name: { $in: parts.credits } }, { _id: 1 }).exec(function(err, credits) {
                
                // all we want are the IDs...
                var creditIDs = credits.map(function(x) { return x._id; });

                // update the corresponding track to set values...
                // new? title
                // new? artist
                // new? credits
                Track.update(
                  { _id: track._id },
                  {
                      $addToSet: { _credits: { $each: creditIDs }  }
                    , $set: {
                          _artist: (artist && artist._id.toString() != track._artist.toString()) ? artist._id : track._artist
                        , title: parts.title || track.title
                      }
                  }
                ).exec(function(err, numAffected) {
                  console.log(err || numAffected);

                  res.send({
                      status: 'success'
                    , message: 'Track edited successfully.'
                  });

                  // prepare for over-the-wire broadcast...
                  track = track.toObject();
                  track._artist = artist;

                  req.soundtrack.broadcast({
                      type: 'edit'
                    , track: track
                  });
                });
              });
            });
          });
        });
      });
    }
  },
  merge: function(req, res, next) {
    Track.findOne({ _id: req.param('from') }).exec(function(err, from) {
      Track.findOne({ _id: req.param('to') }).exec(function(err, to) {

      });
    });
  },
  view: function(req, res, next) {
    // TODO: use artist in the lookup
    Track.findOne({ $or: [
        { _id: req.param('trackID') }
      , { slug: req.param('trackSlug') }
    ] }).populate('_artist _credits').exec(function(err, track) {
      if (!track) { return next(); }

      var functions = [
        function(done) {
          Chat.find({ _track: track._id }).sort('-_id').limit(20).populate('_author').exec( done );
        }
      ];

      console.log(track._artist);
      console.log(track._artist.slug.length);

      if (!track._artist || (track._artist && track._artist.slug === '')) {

        console.log('yoooo gabba gabba fell into the thing')

        functions.push(function(done) {

          var stringToParse = '';

          for (var source in track.sources) {
            for (var i = 0; i < track.sources[source].length; i++) {
              if (track.sources[ source ][i].data && track.sources[ source ][i].data.title) {
                stringToParse  = track.sources[ source ][i].data.title;
              }
            }
          }

          console.log('parsing: ' + stringToParse);
          util.parseTitleString( stringToParse , function(parts) {

            Artist.findOne({ name: parts.artist }).exec(function(err, artist) {
              if (!artist) { var artist = new Artist({ name: parts.artist }); }

              Artist.find({ name: { $in: parts.credits } }, { _id: 1 }).exec(function(err, artists) {
                var creditIDs = artists.map(function(x) { return x._id.toString(); });

                console.log(creditIDs);

                Track.update(
                  { _id: track._id },
                  {
                      $addToSet: { _credits: { $each: creditIDs }  }
                    , $set: {
                          _artist: (artist && artist._id.toString() != track._artist.toString()) ? artist._id : track._artist
                        , title: parts.title || track.title
                      }
                  }
                ).exec( done );
              });
            });
          });
        });
      }

      console.log('functions length is ' + functions.length );

      async.series( functions , function(err, results) {
        var chats = results[0];

        console.log(results[1]);

        Track.findOne({ $or: [
            { _id: req.param('trackID') }
          , { slug: req.param('trackSlug') }
        ] }).populate('_artist _credits').exec(function(err, track) {

          /**/req.soundtrack.gatherSources(track , function(err, sources) {
            console.log(err , sources);
            //console.log( sources.length );
            console.log('SOURCE GATHERING COMPLETE');
          });/**/

          res.format({
            json: function() {
              res.send( track );
            },
            html: function() {
              Play.find({ _track: track._id }).sort('-timestamp').populate('_curator').exec(function(err, history) {
                if (err) { console.log(err); }

                var queries = [];
                for (var d = 29; d >= 0; d--) {

                  var start = new Date();
                  start.setHours('0');
                  start.setMinutes('0');
                  start.setSeconds('0');
                  start.setMilliseconds('0');

                  var end = new Date( start.getTime() );

                  start = new Date( start - (d * 1000 * 60 * 60 * 24) );
                  end = new Date( start.getTime() + 1000 * 60 * 60 * 24 );

                  queries.push({ timestamp: {
                      $gte: start
                    , $lt: end
                  } });
                }
                
                // TODO: use some sort of map so this can be switched parallel
                async.series(
                  queries.map(function(q) {
                    return function(done) { Play.count( _.extend({ _track: track._id }, q) ).exec(done); };
                  }), function(err, playsPerDay) {

                    Track.find({
                        _artist: track._artist._id
                      , slug: track.slug
                    }).exec(function(err, dupes) {

                      res.render('track', {
                          track: track
                        , history: history
                        , playsPerDay: playsPerDay
                        , chats: chats
                        , dupes: dupes
                      });
                    });
                  }
                );
              });
            }
          });
        });
      });
    });
  }
}
