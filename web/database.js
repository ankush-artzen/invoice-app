import pkg from 'pg';
const { Pool } = pkg;


class Database {
    constructor(connectionString) {
        this.pool = new Pool({
            ssl: {
                rejectUnauthorized: false
            },
            connectionString: "postgres://u3q1gl19ptribr:p8efb403275ab1d82fc307c40efbefe850c137a261df1cd2b344c9ab28d6558db@c5lfqsjum2oudl.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d9vqdd02vi38jj"
        });
    }

    async connect() {
        try {
            await this.pool.connect();
            console.log("Database connected successfully");
        } catch (error) {
            console.error("Database connection failed:", error);
        }
    }

    async query(query, values) {
        try {
            const result = await this.pool.query(query, values);
            return result.rows;
        } catch (error) {
            console.error("Database query failed:", error);
            return null;
        }
    }

    async insertData(tableName, data) {
        // Assuming data is an object with key-value pairs
        const keys = Object.keys(data);
        const values = Object.values(data);

        const query = `
            INSERT INTO ${tableName} (${keys.join(", ")})
            VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
            RETURNING *;
        `;

        return await this.query(query, values);
    }

    async updateData(tableName, data, condition) {
        // Assuming data and condition are objects with key-value pairs
        const keys = Object.keys(data);
        const values = Object.values(data);

        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
        const whereClause = Object.entries(condition)
            .map(([key, value], i) => `${key} = $${keys.length + i + 1}`)
            .join(" AND ");

        const query = `
            UPDATE ${tableName}
            SET ${setClause}
            WHERE ${whereClause}
            RETURNING *;
        `;

        return await this.query(query, [...values, ...Object.values(condition)]);
    }

    async selectData(tableName, condition) {
        // Assuming condition is an object with key-value pairs
        const whereClause = Object.entries(condition)
            .map(([key, value], i) => `${key} = $${i + 1}`)
            .join(" AND ");

        const query = `
            SELECT * FROM ${tableName}
            WHERE ${whereClause};
        `;

        return await this.query(query, Object.values(condition));
    }

    //function that sets creditnote_id to parameter creditNoteId in table orders



}

export default Database;
