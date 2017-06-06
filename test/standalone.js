'use strict';

const Lab = require('lab');
const Code = require('code');
const PouchMiddleware = require('../lib/');

const lab = Lab.script();
exports.lab = lab;
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;

describe('Pouch Redux Middleware', () => {
  it('cannot be created with no paths', done => {
    expect(() => {
      PouchMiddleware();
    }).to.throw('PouchMiddleware: no paths');
    done();
  });

  it('requires db in path', done => {
    expect(() => {
      PouchMiddleware([{}]);
    }).to.throw('path undefined needs a db');
    done();
  });
});
