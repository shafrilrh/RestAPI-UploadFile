const express = require("express")
const app = express()
const multer = require("multer") // untuk upload file
const path = require("path") // untuk memanggil path direktori
const fs = require("fs") // untuk manajemen file
const mysql = require("mysql")
const cors = require("cors")
const moment = require("moment")
const crypto = require("crypto")
const md5 = require("md5")
const Cryptr = require("cryptr")
const crypt = new Cryptr("20404002") // secret key, boleh diganti kok

app.use(express.static(__dirname));
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(cors())

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "olshop"
})

db.connect(error => {
    if (error) {
        console.log(error.message)
    } else {
        console.log("MySQL Connected")
    }
})

app.listen(8000, () =>{
    console.log("Server run on port 8000");
})

// Authentication
Token = () => {
    return (req, res, next) => {
        // cek keberadaan "Token" pada request header
        if (!req.get("Token")) {
            // jika "Token" tidak ada
            res.json({
                message: "Access Forbidden"
            })
        } else {
            // tampung nilai Token
            let token  = req.get("Token")
            
            // decrypt token menjadi id_admin
            let decryptToken = crypt.decrypt(token)

            // sql cek id_admin
            let sql = "select * from admin where ?"

            // set parameter
            let param = { id_admin: decryptToken}

            // run query
            db.query(sql, param, (error, result) => {
                if (error) throw error
                 // cek keberadaan id_admin
                if (result.length > 0) {
                    // id_admin tersedia
                    next()
                } else {
                    // jika admin tidak tersedia
                    res.json({
                        message: "Invalid Token"
                    })
                }
            })
        }

    }
}

// endpoint login admin (authentication)
app.post("/admin/auth", (req, res) => {
    // tampung username dan password
    let param = [
        req.body.username, //username
        md5(req.body.password) // password
    ]
    

    // create sql query
    let sql = "select * from admin where username = ? and password = ?"

    // run query
    db.query(sql, param, (error, result) => {
        if (error) throw error

        // cek jumlah data hasil query
        if (result.length > 0) {
            // admin tersedia
            res.json({
                message: "Logged",
                token: crypt.encrypt(result[0].id_admin), // generate token
                data: result
            })
        } else {
            // admin tidak tersedia
            res.json({
                message: "Invalid username/password"
            })
        }
    })
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // set file storage
        cb(null, './image');
    },
    filename: (req, file, cb) => {
        // generate file name 
        cb(null, "image-"+ Date.now() + path.extname(file.originalname))
    }
})

let upload = multer({storage: storage})

// barang =====================================================================================

// endpoint untuk menambah data barang baru
app.post("/barang", Token(), upload.single("image"), (req, res) => {
    // prepare data
    let data = {
        nama_barang: req.body.nama_barang,
        harga: req.body.harga,
        stok: req.body.stok,
        deskripsi: req.body.deskripsi,
        image: req.file.filename
    }

    if (!req.file) {
        // jika tidak ada file yang diupload
        res.json({
            message: "Tidak ada file yang dikirim"
        })
    } else {
        // create sql insert
        let sql = "insert into barang set ?"

        // run query
        db.query(sql, data, (error, result) => {
            if(error) throw error
            res.json({
                message: result.affectedRows + " data berhasil disimpan"
            })
        })
    }
})

// endpoint untuk mengubah data barang
app.put("/barang", Token(), upload.single("image"), (req,res) => {
    let data = null, sql = null
    // paramter perubahan data
    let param = { kode_barang: req.body.kode_barang }

    if (!req.file) {
        // jika tidak ada file yang dikirim = update data saja
        data = {
            nama_barang: req.body.nama_barang,
            harga: req.body.harga,
            stok: req.body.stok,
            deskripsi: req.body.deskripsi
        }
    } else {
        // jika mengirim file = update data + reupload
        data = {
            nama_barang: req.body.nama_barang,
            harga: req.body.harga,
            stok: req.body.stok,
            deskripsi: req.body.deskripsi,
            image: req.file.filename
        }

        // get data yg akan diupdate utk mendapatkan nama file yang lama
        sql = "select * from barang where ?"
        // run query
        db.query(sql, param, (err, result) => {
            if (err) throw err
            // tampung nama file yang lama
            let fileName = result[0].image

            // hapus file yg lama
            let dir = path.join(__dirname,"image",fileName)
            fs.unlink(dir, (error) => {})
        })

    }

    // create sql update
    sql = "update barang set ? where ?"

    // run sql update
    db.query(sql, [data,param], (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil diubah"
            })
        }
    })
})

// endpoint untuk menghapus data barang
app.delete("/barang/:kode_barang", Token(), (req,res) => {
    let param = {kode_barang: req.params.kode_barang}

    // ambil data yang akan dihapus
    let sql = "select * from barang where ?"
    // run query
    db.query(sql, param, (error, result) => {
        if (error) throw error
        
        // tampung nama file yang lama
        let fileName = result[0].image

        // hapus file yg lama
        let dir = path.join(__dirname,"image",fileName)
        fs.unlink(dir, (error) => {})
    })

    // create sql delete
    sql = "delete from barang where ?"

    // run query
    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil dihapus"
            })
        }      
    })
})

// endpoint menampilkan data barang
app.get("/barang", Token(), (req, res) => {
    // create sql query
    let sql = "select * from barang"

    // run query
    db.query(sql, (error, result) => {
        if (error) throw error
        res.json({
            data: result,
            count: result.length
        })
    })
})
// barang =====================================================================================

// admin =====================================================================================
// end-point akses data admin
app.get("/admin", Token(),(req, res) => {
    // create sql query
    let sql = "select * from admin"

    // run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                admin: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point akses data admin berdasarkan id_admin tertentu
app.get("/admin/:id", Token(), (req, res) => {
    let data = {
        id_admin: req.params.id
    }
    // create sql query
    let sql = "select * from admin where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                admin: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point menyimpan data admin
app.post("/admin", Token(), (req,res) => {

    // prepare data
    let data = {
        nama_admin: req.body.nama_admin,
        username: req.body.username,
        // hash password ke md5
        password: md5(req.body.password)
    }

    // create sql query insert
    let sql = "insert into admin set ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data inserted"
            }
        }
        res.json(response) // send response
    })
})

// end-point mengubah data admin
app.put("/admin",Token(), (req,res) => {

    // prepare data
    let data = [
        // data
        {
            nama_admin: req.body.nama_admin,
            username: req.body.username,
            // hash password ke md5
            password: md5(req.body.password)
        },

        // parameter (primary key)
        {
            id_admin: req.body.id_admin
        }
    ]

    // create sql query update
    let sql = "update admin set ? where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data updated"
            }
        }
        res.json(response) // send response
    })
})

// end-point menghapus data admin berdasarkan id_admin
app.delete("/admin/:id",Token(), (req,res) => {
    // prepare data
    let data = {
        id_admin: req.params.id
    }

    // create query sql delete
    let sql = "delete from admin where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " data deleted"
            }
        }
        res.json(response) // send response
    })
})
// admin =====================================================================================

// users =====================================================================================
// end-point akses data users
app.get("/users", Token(),(req, res) => {
    // create sql query
    let sql = "select * from users"

    // run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                users: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point akses data users berdasarkan id_users tertentu
app.get("/users/:id",Token(), (req, res) => {
    let data = {
        id_users: req.params.id
    }
    // create sql query
    let sql = "select * from users where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                users: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point menyimpan data users
app.post("/users",Token(), upload.single("image"), (req,res) => {

    // prepare data
    let data = {
        nama_users: req.body.nama_users,
        alamat: req.body.alamat,
        username: req.body.username,
        password: md5(req.body.password),
        image: req.file.filename
    }

    if (!req.file) {
        // jika tidak ada file yang diupload
        res.json({
            message: "Tidak ada file yang dikirim"
        })
    } else {
        // create sql insert
        let sql = "insert into users set ?"

        // run query
        db.query(sql, data, (error, result) => {
            if(error) throw error
            res.json({
                message: result.affectedRows + " data berhasil disimpan"
            })
        })
    }
})

// endpoint untuk mengubah data users
app.put("/users", Token(), upload.single("image"), (req,res) => {
    let data = null, sql = null
    // paramter perubahan data
    let param = { id_users: req.body.id_users }

    if (!req.file) {
        // jika tidak ada file yang dikirim = update data saja
        data = {
            nama_users: req.body.nama_users,
            alamat: req.body.alamat,
            username: req.body.username,
            password: md5(req.body.password)
        }
    } else {
        // jika mengirim file = update data + reupload
        data = {
            nama_users: req.body.nama_users,
            alamat: req.body.alamat,
            username: req.body.username,
            password: md5(req.body.password),
            image: req.file.filename
        }

        // get data yg akan diupdate utk mendapatkan nama file yang lama
        sql = "select * from users where ?"
        // run query
        db.query(sql, param, (err, result) => {
            if (err) throw err
            // tampung nama file yang lama
            let fileName = result[0].image

            // hapus file yg lama
            let dir = path.join(__dirname,"image",fileName)
            fs.unlink(dir, (error) => {})
        })

    }

    // create sql update
    sql = "update users set ? where ?"

    // run sql update
    db.query(sql, [data,param], (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil diubah"
            })
        }
    })
})

// endpoint untuk menghapus data users
app.delete("/users/:id_users", Token(), (req,res) => {
    let param = {id_users: req.params.id_users}

    // ambil data yang akan dihapus
    let sql = "select * from users where ?"
    // run query
    db.query(sql, param, (error, result) => {
        if (error) throw error
        
        // tampung nama file yang lama
        let fileName = result[0].image

        // hapus file yg lama
        let dir = path.join(__dirname,"image",fileName)
        fs.unlink(dir, (error) => {})
    })

    // create sql delete
    sql = "delete from users where ?"

    // run query
    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil dihapus"
            })
        }      
    })
})
// users =====================================================================================

// transaksi =====================================================================================
// end-point akses data transaksi
app.get("/transaksi", Token(),(req, res) => {
    // create sql query
    let sql = "select * from transaksi"

    // run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                transaksi: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point akses data transaksi berdasarkan kode_transaksi tertentu
app.get("/transaksi/:kode",Token(), (req, res) => {
    let data = {
        kode_transaksi: req.params.kode
    }
    // create sql query
    let sql = "select * from transaksi where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message // pesan error
            }            
        } else {
            response = {
                count: result.length, // jumlah data
                transaksi: result // isi data
            }            
        }
        res.json(response) // send response
    })
})

// end-point menambahkan data transaksi

app.post("/transaksi", (req,res) => {
    // prepare data to transaksi
    let data = {
        id_users: req.body.id_users,
        tgl_transaksi: moment().format('YYYY-MM-DD HH:mm:ss') // get current time
    }

    // parse to JSON
    let transaksi = JSON.parse(req.body.transaksi)

    // create query insert to transaksi
    let sql = "insert into transaksi set ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        
        if (error) {
            res.json({message: error.message})
        } else {
            
            // get last inserted kode_transaksi
            let lastID = result.insertId

            // prepare data to detail_transaksi
            let data = []
            for (let index = 0; index < transaksi.length; index++) {
                data.push([
                    lastID, transaksi[index].kode_transaksi
                ])                
            }

            // create query insert detail_transaksi
            let sql = "insert into detail_transaksi values ?"

            db.query(sql, [data], (error, result) => {
                if (error) {
                    res.json({message: error.message})
                } else {
                    res.json({message: "Data has been inserted"})
                }
            })
        }
    })
})

// end-point menampilkan data transaksi
app.get("/transaksi", (req,res) => {
    // create sql query
    let sql = "select t.kode_transaksi, t.id_users, t.tgl_transaksi, b.nama_barang, b.harga, t.id_users, u.nama_users " +
     "from transaksi t join brang b on t.nama_barang = b.nama_barang " +
     "join users u on t.id_users = u.id_users"

    // run query
    db.query(sql, (error, result) => {
        if (error) {
            res.json({ message: error.message})   
        }else{
            res.json({
                count: result.length,
                transaksi: result
            })
        }
    })
})

// end-point untuk menampilkan detail transaksi
app.get("/transaksi/:kode_transaksi", (req,res) => {
    let param = { kode_transaksi: req.params.kode_transaksi}

    // create sql query
    let sql = "select t.kode_transaksi, t.harga_beli " + 
    "from detail_transaksi dt join transaksi t "+
    "on t.kode_transaksi = dt.kode_transaksi " +
    "where ?"

    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({ message: error.message})   
        }else{
            res.json({
                count: result.length,
                detail_transaksi: result
            })
        }
    })
})

// end-point untuk menghapus data transaksi
app.delete("/transaksi/:kode_transaksi", (req, res) => {
    let param = { kode_transaksi: req.params.kode_transaksi}

    // create sql query delete detail_transaksi
    let sql = "delete from detail_transaksi where ?"

    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({ message: error.message})
        } else {
            let param = { kode_transaksi: req.params.kode_transaksi}
            // create sql query delete transaksi
            let sql = "delete from transaksi where ?"

            db.query(sql, param, (error, result) => {
                if (error) {
                    res.json({ message: error.message})
                } else {
                    res.json({message: "Data has been deleted"})
                }
            })
        }
    })

})
// transaksi =====================================================================================
