const fs = require("fs");

/**
 * Generate random auto code for baillers
 * @param {Number} length - Length of the code (default: 6)
 * @returns {String} - Random generated code
 */
const generateAutoCode = (length = 6) => {
	const characters = '0123456789';
	let code = '';
	for (let i = 0; i < length; i++) {
		code += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return code;
};

/**
 * Generate unique auto code ensuring it doesn't already exist
 * @param {Array} existingCodes - Array of existing codes
 * @param {Number} length - Length of the code (default: 6)
 * @returns {String} - Unique random generated code
 */
const generateUniqueAutoCode = (existingCodes = [], length = 6) => {
	let code;
	let isUnique = false;
	
	while (!isUnique) {
		code = generateAutoCode(length);
		if (!existingCodes.includes(code)) {
			isUnique = true;
		}
	}
	
	return code;
};

/**
 * Save generated code to database
 * @param {String} code - The code to save
 * @param {String} userId - User ID who generated the code
 * @param {String} _dir - Database directory path
 */
const saveAutoCode = (code, userId, _dir = './database/autoCodes.json') => {
	try {
		let codes = [];
		if (fs.existsSync(_dir)) {
			codes = JSON.parse(fs.readFileSync(_dir));
		}
		
		codes.push({
			code: code,
			userId: userId,
			createdAt: Date.now(),
			used: false
		});
		
		fs.writeFileSync(_dir, JSON.stringify(codes, null, 2));
		return true;
	} catch (error) {
		console.error("Error saving code:", error);
		return false;
	}
};

module.exports = {
	generateAutoCode,
	generateUniqueAutoCode,
	saveAutoCode
};
