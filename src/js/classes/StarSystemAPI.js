import $ from 'jquery'; // I'm so sorry.
import AppConfig from '../../../app.config.js';
export default class StarSystemAPI {
  /**
   * Calls upon the FuelRats star system API to get info for the system with the given system name.
   *
   * @param  {String}                 system Name of the star system to gather info about.
   * @return {Promise.<Object|Error>}        Promise which fulfills with an object containing detailed information the star system, or rejects with an error if something goes wrong.
   */
  static _apiLookupCall(system) {
    return new Promise((resolve, reject) => {
      system = system.toUpperCase();
      $.ajax({
        dataType: 'json',
        url: `https://system.api.fuelrats.com/systems?filter[name:eq]=${encodeURIComponent(system)}&include=bodies`,
        success: function(response) {
          if (response.meta.results.returned < 1) {

            window.console.debug(`StarSystems - No system info found for: ${system}. Sysinfo search failed. Calling failCallback.`);

            sessionStorage.setItem(`${AppConfig.AppNamespace}.system.${system.toUpperCase()}`, null); // This essentially marks it as missing, and we should not look for it again.
            reject("System not found.");
            return;
          }
          let sysData = response.data[0];
          let sysName = sysData.attributes.name;

          //jsonAPI does not yet support included data filtering, so this cannot be offloaded to the server.
          if (response.included && response.included[0]) {
            sysData.bodies = response.included.filter(function(body) {
              return body.attributes.group_name === "Star";
            });
            //cleanup body info
            for (let body in sysData.bodies) {
              if (sysData.bodies.hasOwnProperty(body)) {
                delete sysData.bodies[body].relationships;
                delete sysData.bodies[body].type;
                delete sysData.bodies[body].links;
              }
            }
          }
          //clean up other json properties.
          delete sysData.relationships;
          delete sysData.type;
          delete sysData.links;

          if (!sessionStorage.getItem(`${AppConfig.AppNamespace}.system.${sysName}`)) { //we're gonna check this to be safe.
            sessionStorage.setItem(`${AppConfig.AppNamespace}.system.${sysName}`, JSON.stringify(sysData));
          }

          window.console.debug("StarSystems - System information found: ", sysData);

          resolve(sysData);
        },
      });
    });
  }
  
  /**
   * Attempts to find the given system within the system cache. If it's not found, a call to the API is made to gather it.
   *
   * @param  {String}                 system Name of the star system to gather info about.
   * @return {Promise.<Object|Error>}        Promise which fulfills with an object containing detailed information the star system, or rejects with an error if something goes wrong.
   */
  static get(system) {
    system = system.toUpperCase();
    if (sessionStorage.getItem(`${AppConfig.AppNamespace}.system.${system}`)) {

      let sysData = JSON.parse(sessionStorage.getItem(`${AppConfig.AppNamespace}.system.${system}`));
      window.console.debug("StarSystems - Cached System Info Requested: ", sysData);

      if (sysData === null) {
        return Promise.reject("System not found.");
      }
      return Promise.resolve(sysData);

    } else {
      window.console.debug(`StarSystems - Retrieving System Info: ${system}`);
      return this._apiLookupCall(system);
    }
  }
  
  static deleteCachedInfo(system) {
    let sysName = system.toUpperCase();
    if (sessionStorage.getItem(`${AppConfig.AppNamespace}.system.${sysName}`)) {
      sessionStorage.removeItem(`${AppConfig.AppNamespace}.system.${sysName}`);
    }
  }
}