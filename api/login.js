import { checkPassword, clearCookie, isAdmin, sessionCookie } from "../lib/auth.js";
import { body, route, HttpError } from "../lib/http.js";

export default route({
  GET: (req, res) => res.json({ admin: isAdmin(req) }),
  POST: (req, res) => {
    if (!checkPassword(body(req).password)) throw new HttpError(401, "Нууц үг буруу байна");
    res.setHeader("Set-Cookie", sessionCookie());
    res.json({ admin: true });
  },
  DELETE: (req, res) => {
    res.setHeader("Set-Cookie", clearCookie());
    res.json({ admin: false });
  },
});
