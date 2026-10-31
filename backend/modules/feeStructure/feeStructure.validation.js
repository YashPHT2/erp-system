const { FEE_COMPONENTS } = require('../../constants');
const { sumPaise } = require('../../utils/money');
const ApiError = require('../../utils/ApiError');
const {
  requiredText,
  optionalText,
  assertAcademicYear,
  classKey,
  sectionKey,
  validateComponents,
} = require('../../utils/validate');

function validateFeeStructure(body) {
  const academicYear = assertAcademicYear(body?.academicYear);
  const className = requiredText(body?.className, 'Class', { min: 2, max: 80 });
  const section = optionalText(body?.section, 'Section', { min: 1, max: 8 });
  if (section && !/^[A-Za-z0-9]+$/.test(section)) {
    throw new ApiError(400, 'Section can only contain letters and numbers.', 'VALIDATION_ERROR');
  }
  const components = validateComponents(body?.components, FEE_COMPONENTS, 'fee component');
  const totalAmountPaise = sumPaise(components.map((component) => component.amountPaise));
  return {
    academicYear,
    className,
    classKey: classKey(className),
    section: section ? section.toUpperCase() : '',
    sectionKey: sectionKey(section),
    components,
    totalAmountPaise,
  };
}

module.exports = { validateFeeStructure };
