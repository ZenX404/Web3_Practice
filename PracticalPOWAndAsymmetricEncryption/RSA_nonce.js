const crypto = require('crypto');

function generateRSAKeyPair() {
    console.log("正在生成公私钥对")
    
    const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    console.log('RSA 密钥对生成完成！');
    return {publicKey, privateKey};
}

function minePow(nickName, difficulty) {
    let nonce = 0;
    const target = '0'.repeat(difficulty);
    let hash = crypto.createHash('sha256').update(nickName + nonce).digest('hex');

    console.log("开始挖矿");
    const startTime = Date.now();
    while (!hash.startsWith(target)) {
        nonce++;
        hash = crypto.createHash('sha256').update(nickName + nonce).digest('hex');

        // 每处理 100 万个 nonce 打印一次进度
        if (nonce % 1000000 === 0) {
            console.log(`已尝试 ${nonce.toLocaleString()} 个 nonce 值...`);
        }
    }

    console.log("出块成功");
    const endTime = Date.now();
    return {
        timeSpent: endTime - startTime,
        hash,
        nonce
    };

}

function signData(privateKey, data) {
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, "hex");
}

function verifySignature(publicKey, signature, data) {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "hex");
}




function main() {
    // 1、生成RSA公私钥对
    const {publicKey, privateKey} = generateRSAKeyPair();
    console.log('公钥:');
    console.log(publicKey);
    console.log('私钥:');
    console.log(privateKey);

    // 2、POW工作量证明挖矿
    const mineResult = minePow("ZenX", 4);
    console.log(mineResult);

    const content = "我要发送签名啦";
    // 3、生成签名
    console.log('\n使用私钥对哈希内容进行签名...');
    const signature = signData(privateKey, content);
    console.log("签名：", signature);

    // 4、校验签名
    console.log('\n使用公钥验证签名...');
    const isValid = verifySignature(publicKey, signature, content);
    console.log(`签名验证结果: ${isValid ? '验证成功' : '验证失败'}`);
}

main();