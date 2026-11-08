/*
 * Edition switch. test: true = the partner test version:
 *  - starts empty (no demo assessment) and keeps its data separate from the full version;
 *  - projects come only from imported Excel files (demo projects and the PDM connection are hidden, not removed);
 *  - Settings shows only the Excel imports; "Delete all data" also deletes the Excel imports.
 */
window.RSA = window.RSA || {};
window.RSA.Edition = { test: true, login: { user: 'ADMIN', hash: '2f2b062d6f40cbfbab1f5644904494f3c9b8ed6ca42be03b0b47537d247af2e1' }, feedback: { email: '' } };
/* Optional sign-in screen (used by the test version):
   window.RSA.Edition.login = { user: 'ADMIN', hash: '<SHA-256 of the password, hex>' }; */
/* Where "Send feedback" sends to (the tester's email program opens with the message filled in).
   Leave it empty and the feedback is saved as a text file instead:
   window.RSA.Edition.feedback = { email: 'name@example.org' }; */
