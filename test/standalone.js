var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var before = lab.before;
var after = lab.after;
var it = lab.it;
var Code = require('code');
var expect = Code.expect;

var PouchMiddleware = require('../lib/');

var PouchDB = require('pouchdb');
var db = new PouchDB('todos', {
  db: require('memdown'),
});

describe('Pouch Redux Middleware', function() {
  var pouchMiddleware;
  var store;

  it('cannot be created with no paths', function(done) {
    expect(function() {
      PouchMiddleware();
    }).to.throw('PouchMiddleware: no paths');
    done();
  });

  it('requires db in path', function(done) {
    expect(function() {
      PouchMiddleware([{}]);
    }).to.throw('path undefined needs a db');
    done();
  });
});
