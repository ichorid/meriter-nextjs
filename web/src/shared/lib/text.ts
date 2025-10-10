export const textToHTML = (text) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/\n/g, '<br>')
    return newText
}
export const textToTelegramHTML = (text) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/ \n+/g, '\n')
    return newText
}
