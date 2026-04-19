const pool = require('./db');
(async () => {
    try {
        const res = await pool.query("SELECT * FROM users LIMIT 1");
        console.log("users:", res.fields.map(f => f.name));
        const res2 = await pool.query("SELECT * FROM vendors LIMIT 1");
        console.log("vendors:", res2.fields.map(f => f.name));
        const res3 = await pool.query("SELECT * FROM applications LIMIT 1");
        console.log("applications:", res3.fields.map(f => f.name));
        const res4 = await pool.query("SELECT * FROM registration_requests LIMIT 1");
        console.log("registration_requests:", res4.fields.map(f => f.name));
    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
})();
