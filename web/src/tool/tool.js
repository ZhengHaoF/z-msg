
/**
 * 工具类
 */
import CryptoJS from 'crypto-js'

//加密
export const encrypt = function(word,keyStr){
    keyStr = keyStr ? keyStr : "1grLx91U40VawzhRAm7E";
    let key = CryptoJS.enc.Utf8.parse(CryptoJS.MD5(keyStr).toString().toUpperCase());
    let srcs = CryptoJS.enc.Utf8.parse(word);
    let encrypted = CryptoJS.AES.encrypt(srcs, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

//解密
export const decrypt = function(word,keyStr){
    keyStr = keyStr ? keyStr : "1grLx91U40VawzhRAm7E";
    let key = CryptoJS.enc.Utf8.parse(CryptoJS.MD5(keyStr).toString().toUpperCase());
    let decrypt = CryptoJS.AES.decrypt(word, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return CryptoJS.enc.Utf8.stringify(decrypt).toString();
}
