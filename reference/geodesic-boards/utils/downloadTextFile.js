
//a function that downloads a string as a .txt file

export function downloadTextFile (filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    // a: not attached to the DOM → works in every evergreen browser
    Object.assign(document.createElement('a'), {
        href:     url,
        download: filename
    }).click();

    URL.revokeObjectURL(url);      // free the blob’s memory 
}
