module.exports = {
  success: (data) => ({ success: data }),
  error: (message, code = 400) => ({ error: { code, message } })
};
