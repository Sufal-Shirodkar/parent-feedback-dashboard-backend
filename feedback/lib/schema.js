const Joi = require("joi");

const feedbackSchema = Joi.object({
  parent_name: Joi.string().trim().min(1).required(),
  student_name: Joi.string().trim().min(1).required(),
  class_label: Joi.string().trim().min(1).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  continuing: Joi.string().valid("Yes", "No", "Not sure").allow("", null).optional(),
  contact_request: Joi.alternatives()
    .try(Joi.boolean(), Joi.number().valid(0, 1), Joi.string().trim())
    .optional(),
  comments: Joi.string().allow("", null).optional(),
  submitted_at: Joi.any().optional(),
  source_id: Joi.string().trim().min(1).optional(),
}).unknown(true);

module.exports = {
  feedbackSchema,
};
