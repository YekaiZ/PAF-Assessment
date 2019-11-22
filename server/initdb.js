const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;
const aws = require('aws-sdk');

const loadConfig = (config) => {
    return {
        mysql: mysql.createPool(config.mysql),
        mongodb: new MongoClient(config.mongodb.url, { useUnifiedTopology: true }),
        s3: new aws.S3({
            endpoint: new aws.Endpoint('sgp1.digitaloceanspaces.com'),
            accessKeyId: config.s3.accessKey,
            secretAccessKey: config.s3.secret
        })
    }
}

const testConns = (conns) => {
    p1 = new Promise((resolve, reject) => {
        conns.mysql.getConnection((err, conn) => {
            if (err)
                return reject(err)
            conn.ping(err => {
                conn.release();
                if (err)
                    return reject(err)
                console.log("MYSQL OK")
                resolve();
            })
        })
    })
    p2 = new Promise((resolve, reject) => {
        conns.mongodb.connect(err => {
            if (err)
                return reject(err)
            console.log("MONGO OK");
            resolve()
        })
    })
    p3 = new Promise((resolve, reject) => {
        const params = {
            Bucket: 'yekai',
            Key: 'seach.png'
        }
        conns.s3.getObject(params, (err, result) => {
            if (err)
                return reject(err)
            console.log("S3 OK");
            resolve();
        })
    })

    return (Promise.all([p1, p2, p3]))

}

module.exports = { loadConfig, testConns }
