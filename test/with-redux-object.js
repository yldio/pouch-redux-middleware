var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var before = lab.before;
var after = lab.after;
var it = lab.it;
var Code = require('code');
var expect = Code.expect;

var actionTypes = require('./_action_types');
var rootReducer = require('./reducers');

var timers = require('timers');
var async = require('async');
var PouchDB = require('pouchdb');
var db = new PouchDB('todosobject', {
  db: require('memdown'),
});

var redux = require('redux');

var PouchMiddleware = require('../src/');

describe('Pouch Redux Middleware with Objects', function() {
  var pouchMiddleware;
  var store;

  it('todosmaps can be created', function(done) {
    
    pouchMiddleware = PouchMiddleware({
      path: '/todosobject',
      db: db,
      actions: {
        remove: (doc) => { return {type: actionTypes.DELETE_TODO, id: doc._id} },
        insert: (doc) => { return {type: actionTypes.INSERT_TODO, todo: doc} },
        batchInsert: (docs) => { return {type: actionTypes.BATCH_INSERT_TODOS, todos: docs} },
        update: (doc) => { return {type: actionTypes.UPDATE_TODO, todo: doc} }
      },
      changeFilter: doc => !doc.filter
    });
    done();
  });

  it('can be used to create a store', function(done) {
    var createStoreWithMiddleware = redux.applyMiddleware(pouchMiddleware)(redux.createStore);
    store = createStoreWithMiddleware(rootReducer);
    done();
  });

  it('accepts a few inserts', function(done) {
    store.dispatch({type: actionTypes.ADD_TODO, text: 'do laundry', id: 'a'});
    store.dispatch({type: actionTypes.ADD_TODO, text: 'wash dishes', id: 'b'});
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', function(done) {
    async.map(['a', 'b'], db.get.bind(db), function(err, results) {
      if (err) return done(err);
      expect(results.length).to.equal(2);
      expect(results[0].text).to.equal('do laundry');
      expect(results[1].text).to.equal('wash dishes');
      done();
    });
  });

  it('accepts an removal', function(done) {
    store.dispatch({type: actionTypes.DELETE_TODO, id: 'a'});
    timers.setTimeout(done, 100);
  });

  it('saves changes in pouchdb', function(done) {
    db.get('a', function(err) {
      expect(err).to.be.an.object();
      expect(err.message).to.equal('missing');
      done();
    });
  });

});
