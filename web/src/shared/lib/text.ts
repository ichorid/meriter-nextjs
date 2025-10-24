export const textToHTML = (text: string) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/\n/g, '<br>')
    return newText
}
export const textToTelegramHTML = (text: string) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/ \n+/g, '\n')
    return newText
}

export const ellipsize = (text: string, maxLength: number = 40): string => {
    if (!text) return '';
    // Remove newlines and extra spaces
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
}
