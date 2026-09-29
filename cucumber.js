// Cucumber config. The pipeline generates a per-run profile pointing at the
// run's generated features/steps, but this default profile lets you run any
// features under bdd/ manually.
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['bdd/support/**/*.ts', 'bdd/steps/**/*.ts'],
    paths: ['bdd/features/**/*.feature'],
    format: ['progress', 'json:bdd/report/cucumber.json'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
  },
};
