import CryptoJS from 'crypto-js';

export const encryptMessage = (message, key) => {
    return CryptoJS.AES.encrypt(message, key).toString();
};

export const decryptMessage = (encryptedMessage, key) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
};

export const generateHash = (data) => {
    return CryptoJS.SHA256(data).toString();
};

export const generateRandomKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString();
};
