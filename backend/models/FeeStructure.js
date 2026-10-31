const mongoose = require('mongoose');
const { actorSchema, moneyComponentSchema, registerModel } = require('./shared');

const feeStructureSchema = new mongoose.Schema({
  academicYear: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true },
  classKey: { type: String, required: true },
  section: { type: String, default: '' },
  sectionKey: { type: String, default: '' },
  components: {
    type: [moneyComponentSchema],
    validate: {
      validator: (value) => Array.isArray(value) && value.length > 0,
      message: 'Add at least one fee component.',
    },
  },
  totalAmountPaise: { type: Number, required: true, min: 1 },
  createdBy: { type: actorSchema, required: true },
  updatedBy: { type: actorSchema, required: true },
}, { timestamps: true });

feeStructureSchema.index({ academicYear: 1, classKey: 1, sectionKey: 1 }, { unique: true });

module.exports = registerModel('FeeStructure', feeStructureSchema);
