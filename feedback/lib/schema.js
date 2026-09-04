const Joi = require("joi");

const feedbackSchema = Joi.object({
  parent_name: Joi.string().trim().min(1).required(),
  student_name: Joi.string().trim().min(1).required(),
  class_label: Joi.string().trim().min(1).required(),
  rating: Joi.number().required(),
  continuing: Joi.string().allow("", null).optional(),
  contact_request: Joi.alternatives()
    .try(Joi.boolean(), Joi.number(), Joi.string())
    .optional(),
  comments: Joi.string().allow("", null).optional(),
  submitted_at: Joi.any().optional(),
}).unknown(true);

module.exports = {
  feedbackSchema,
};
