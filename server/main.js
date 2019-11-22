const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const hbs = require('express-handlebars');
const request = require('request-promise-native');
const fs = require('fs');

const config = require('./dbconfig');
const { loadConfig, testConns } = require('./initdb');
const conns = loadConfig(config);

const app = express();
const port = parseInt(process.argv[2] || process.env.PORT) || 3000;
const fileUpload = multer({ dest: __dirname + '/tmp' })
app.engine('hbs', hbs({ defaultLayout: 'main.hbs' }));
app.set('view engine', 'hbs');
app.set('views', (__dirname + '/views'));

app.use(cors());
app.use(morgan('tiny'));

// TODO - Task 3
// Song Upload
app.post('/upload', fileUpload.single('mp3file'), (req, resp) => {
    // console.log("REQ FILE", req.file)
    // console.log("REQ BODY", req.body)

    conns.mongodb.db('music').collection('songs')
        .insertOne({
            song_title: req.body.title,
            country: req.body.country,
            slots: req.body.slots || 3,
            lyrics: req.body.lyrics,
            song_url: req.file.filename
        })
        .then(() => {
            fs.readFile(req.file.path, (err, mp3file) => {
                if (err)
                    return err;
                const params = {
                    Bucket: 'yekai',
                    Key: `songs/${req.file.filename}`,
                    Body: mp3file,
                    ContentType: req.file.mimetype,
                    ContentLength: req.file.size,
                    ACL: 'public-read'
                }
                conns.s3.putObject(params, (err, result) => {
                    if (err)
                        return err;
                    resp.status(200).send("Uploaded!")
                })
            })
        })

    resp.on('finish', () => {
        fs.unlink(req.file.path, err => { })
    })
})

// TODO - Task 4
// List all songs 
app.get('/listAll', (req, resp) => {
    conns.mongodb.db('music').collection('songs')
        .find({})
        .toArray()
        .then(result => {
            const c = result.map(v => {
                return new Promise((resolve, reject) => {
                    conns.mongodb.db('music').collection('country')
                        .find({
                            code: v.country
                        })
                        .toArray()
                        .then(result => {
                            v.country = result[0].name
                            return v;
                        })
                        .then(v => {
                            conns.mysql.getConnection((err, conn) => {
                                if (err)
                                    throw err
                                const id = String(v._id);
                                conn.query('select * from song_currently_listening where song_id = ?', [id], (err, result) => {
                                    conn.release();
                                    if (err)
                                        throw err
                                    v.checkedOut = v.slots - result.length;
                                    resolve(v)
                                })
                            })
                        })
                        .catch(() => {
                            reject();
                        })
                })
            })
            Promise.all(c).then(result => {
                resp.status(200).send(result)
            }).catch(err => {
                resp.status(400).send("ERROR")
            })
        })
})

// TODO - Task 5
// List available songs for listening
app.get('/listAvailable', (req, resp) => {
    //reused listen all
})

// TODO - Task 6
// Listening a song
app.post('/listenSong', express.json(), (req, resp) => {
    const username = req.query.username || 'fred';
    console.log("REQ BODY", req.body)
    const song = [
        req.body._id,
        req.body.song_title,
        username,
        new Date()
    ]
    console.log("SING IS",song)
    const INSERTINTOSONGS = 'insert into song_currently_listening(song_id, song_name, username, checkout_time) values (?,?,?,?)'
    conns.mysql.getConnection((err, conn) => {
        if (err)
            return resp.status(400).send("ERROR CONNECTING MYSQL")
        conn.query(INSERTINTOSONGS, song, (err, result) => {
            if (err)
                return resp.status(400).send("ERROR INSERTING MYSQL")
            resp.status(200).send("Inserted into songs")
        })
    })
})


app.use('/upload', (req, resp) => {
    const getCountryAPIURL = 'https://api.printful.com/countries';
    conns.mongodb.db('music').collection('country')
        .findOne({})
        .then(result => {
            console.log(result)
            const current = new Date().getTime();
            if ((current - result.update_time) > (1000 * 60 * 60 * 24 * 30)) {
                request.get(getCountryAPIURL).then(result => {
                    const data = JSON.parse(result);
                    data.result.map(v => {
                        v.update_time = new Date().getTime();
                    })
                    conns.mongodb.db('music').collection('country')
                        .insertMany(data.result)
                    resp.status(200).render('upload', { result: data.result })
                })
            }
            else {
                conns.mongodb.db('music').collection('country')
                    .find({})
                    .toArray()
                    .then(result => {
                        console.log("else result", result)
                        resp.status(200).render('upload', { result: result })
                    })
            }
        })

})

testConns(conns).then(() => {
    app.listen(port, () => {
        console.log(`App started, listening on ${port} on ${new Date()}`)
    })
}).catch(err => {
    console.log("Connection error: ", err)
    process.exit(-1);
})


