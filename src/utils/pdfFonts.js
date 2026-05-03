// Roboto Unicode font regisztrálása jsPDF-be (magyar ő/ű karakterek miatt).
// Az alap Helvetica CP1252-alapú és nem ismeri ezeket.
import robotoRegularUrl from '../assets/fonts/Roboto-Regular.ttf?url';
import robotoBoldUrl from '../assets/fonts/Roboto-Bold.ttf?url';

let fontsLoaded = null;

export async function ensureRobotoRegistered(doc) {
  if (!fontsLoaded) {
    fontsLoaded = Promise.all([
      fetch(robotoRegularUrl).then((r) => r.arrayBuffer()),
      fetch(robotoBoldUrl).then((r) => r.arrayBuffer()),
    ]).then(([reg, bold]) => ({
      regular: arrayBufferToBase64(reg),
      bold:    arrayBufferToBase64(bold),
    }));
  }
  const { regular, bold } = await fontsLoaded;
  doc.addFileToVFS('Roboto-Regular.ttf', regular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', bold);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
