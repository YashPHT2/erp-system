const mongoose = require('mongoose');
const { actorSchema, registerModel } = require('./shared');
const bookSchema = new mongoose.Schema({
  bookCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  title: { type: String, required: true }, author: { type: String, required: true },
  category: { type: String, required: true }, publisher: { type: String, default: '' },
  isbn: { type: String, default: '' }, shelf: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });
const copySchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true, index: true },
  accessionNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['available','issued','maintenance','lost','retired'], default: 'available' },
}, { timestamps: true });
const loanSchema = new mongoose.Schema({
  copyId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryCopy', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookTitle: { type: String, required: true }, accessionNumber: { type: String, required: true },
  borrowerName: { type: String, required: true }, borrowerEmail: { type: String, required: true },
  borrowerRole: { type: String, enum: ['STUDENT','TEACHER'], required: true },
  studentAdmissionNumber: { type: String, default: '' },
  issuedAt: { type: Date, required: true }, dueDate: { type: String, required: true },
  status: { type: String, enum: ['issued','returned'], default: 'issued' },
  returnedAt: { type: Date, default: null }, returnCondition: { type: String, enum: ['good','damaged','lost'] },
  issuedBy: { type: actorSchema, required: true }, returnedBy: actorSchema,
  notes: { type: String, default: '' }, returnNotes: { type: String, default: '' },
  renewalCount: { type: Number, default: 0 },
  renewals: [{ from: String, to: String, at: Date, by: actorSchema, _id: false }],
}, { timestamps: true });
loanSchema.index({ copyId: 1 }, { unique: true, partialFilterExpression: { status: 'issued' } });
loanSchema.index({ borrowerId: 1, bookId: 1 }, { unique: true, partialFilterExpression: { status: 'issued' } });
loanSchema.index({ borrowerId: 1, status: 1 });
loanSchema.index({ status: 1, dueDate: 1 });
module.exports = {
  LibraryBook: registerModel('LibraryBook', bookSchema),
  LibraryCopy: registerModel('LibraryCopy', copySchema),
  LibraryLoan: registerModel('LibraryLoan', loanSchema),
};
