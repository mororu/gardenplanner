/*
 * Die zweite Falle: eine Seite **ohne** actions. Sie zieht abweisen nicht, und
 * das ist richtig -- ein Import, den niemand braucht, waere hier der Fehler.
 * Die Regel muss schweigen.
 */
export const load = () => ({ zeilen: [] });
