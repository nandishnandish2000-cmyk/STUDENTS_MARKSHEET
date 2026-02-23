const dns = require('dns');
const hostname = 'mysql-38bfd30c-nandishnandish2000-c4ef.e.aivencloud.com';

dns.lookup(hostname, (err, address, family) => {
    if (err) {
        console.error('Lookup failed:', err.message);
    } else {
        console.log('Address:', address);
    }
});
