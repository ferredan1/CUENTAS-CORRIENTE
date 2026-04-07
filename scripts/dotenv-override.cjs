/* Carga .env del proyecto y sobrescribe variables ya definidas en el sistema
 * (p. ej. DATABASE_URL antigua en session/cursor). */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});
