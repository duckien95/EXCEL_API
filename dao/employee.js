var mongoose = require("mongoose");

var EmployeeSchema = mongoose.Schema({
	employeeId: Number,
	fullName: String,
   employeeCode: String,
	dateOfBirth: Number,
	gender: Number,
	placeOfBirth: String,
	permanentAddress: String,
	currentAddress: String,
	telephoneNumber:String,
	mobileNumber: String,
	personalIdNumber: String,
	personalIdIssuedDate: Number,
	personalIdIssuedPlace: String,
	empType: String,
	positionId: Number,
	organizationId: Number,
	positionName: String,
   organizationName: String,
   departmentName: String,
	groupName: String,
	accountNumber: String,
	bank: String,
	firstName: String,
	middleName: String,
	lastName: String,
	email: String,
	deactivate: Boolean,
	status: Number,
	emTypeId: Number,
	secondEmail: [{
		email: String,
		deactivate: Boolean
	}]
});

module.exports = mongoose.model("Employee", EmployeeSchema);
