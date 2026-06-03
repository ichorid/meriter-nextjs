/** E2E suites boot Nest + in-memory Mongo; default 5s hook timeout is too low on Windows CI. */
jest.setTimeout(30000);
