const { NoteCRUDTests } = require('./TestCases/NoteTest');

(async () => {
  try {
    await NoteCRUDTests();
    console.log('All tests passed.');
  } catch (e) {
    console.error('Tests failed:', e);
    process.exit(1);
  }
})();
