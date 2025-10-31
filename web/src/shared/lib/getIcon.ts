import Axios from 'axios'

// Built-in list of popular emojis (LogoJoy service is deprecated)
const POPULAR_EMOJIS = [
    { emoji: '😂', name: 'Смеющееся лицо со слезами радости', keywords: ['laugh', 'joy', 'tears', 'smile', 'смех'] },
    { emoji: '❤️', name: 'Красное сердце', keywords: ['heart', 'love', 'red', 'сердце', 'любовь'] },
    { emoji: '🤣', name: 'Катание по полу от смеха', keywords: ['laugh', 'rolling', 'floor', 'смех'] },
    { emoji: '👍', name: 'Большой палец вверх', keywords: ['thumbs', 'up', 'like', 'good', 'ok', 'лайк'] },
    { emoji: '😭', name: 'Громко плачущее лицо', keywords: ['cry', 'sad', 'tears', 'плач'] },
    { emoji: '🙏', name: 'Сложенные руки', keywords: ['pray', 'thanks', 'please', 'спасибо', 'молитва'] },
    { emoji: '😘', name: 'Лицо, посылающее поцелуй', keywords: ['kiss', 'love', 'heart', 'поцелуй'] },
    { emoji: '🥰', name: 'Улыбающееся лицо с сердечками', keywords: ['love', 'hearts', 'smile', 'любовь'] },
    { emoji: '😍', name: 'Улыбающееся лицо с глазами в форме сердца', keywords: ['love', 'heart', 'eyes', 'влюблён'] },
    { emoji: '😊', name: 'Улыбающееся лицо с улыбающимися глазами', keywords: ['smile', 'happy', 'blush', 'улыбка'] },
    { emoji: '🎉', name: 'Хлопушка', keywords: ['party', 'celebration', 'confetti', 'праздник'] },
    { emoji: '😁', name: 'Улыбающееся лицо с открытым ртом', keywords: ['smile', 'happy', 'grin', 'улыбка'] },
    { emoji: '💕', name: 'Два сердца', keywords: ['hearts', 'love', 'pink', 'сердца'] },
    { emoji: '🥺', name: 'Лицо с умоляющими глазами', keywords: ['pleading', 'puppy', 'eyes', 'cute', 'мило'] },
    { emoji: '🔥', name: 'Огонь', keywords: ['fire', 'hot', 'flame', 'огонь'] },
    { emoji: '😎', name: 'Улыбающееся лицо с солнцезащитными очками', keywords: ['cool', 'sunglasses', 'крутой'] },
    { emoji: '🤔', name: 'Думающее лицо', keywords: ['think', 'thinking', 'hmm', 'думаю'] },
    { emoji: '😅', name: 'Улыбающееся лицо с каплей пота', keywords: ['smile', 'sweat', 'relief', 'нервно'] },
    { emoji: '🙄', name: 'Лицо с закатывающимися глазами', keywords: ['roll', 'eyes', 'annoyed', 'раздражён'] },
    { emoji: '😇', name: 'Улыбающееся лицо с нимбом', keywords: ['angel', 'halo', 'innocent', 'ангел'] },
];

// Removed dead getIconsLogojoyProxy function - endpoint /api/geticonslogojoy doesn't exist

export const getIconsLogojoy = (term: string, page: number) => {
    // Filter emojis based on search term
    const searchTerm = (term || '').toLowerCase();
    
    let filtered = POPULAR_EMOJIS;
    
    if (searchTerm && searchTerm.length > 0) {
        filtered = POPULAR_EMOJIS.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))
        );
    }
    
    // Convert to LogoJoy-compatible format
    const symbols = filtered.map(item => ({
        preview: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(item.emoji)}</text></svg>`,
        svgUrl: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(item.emoji)}</text></svg>`,
        name: item.name,
        emoji: item.emoji
    }));
    
    return Promise.resolve({ symbols });
}
