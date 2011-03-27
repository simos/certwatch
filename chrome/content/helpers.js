/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Certificate Watch.
 *
 * The Initial Developer of the Original Code is
 * Simos Xenitellis.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var CertWatchHelpers =
{
  // Converts a base64-encoded certificate into a  structure.
  convertBase64CertToX509: function(base64cert)
  {
    return Cc["@mozilla.org/security/x509certdb;1"]
                    .getService(Ci.nsIX509CertDB)
                    .constructX509FromBase64(base64cert);
  },

  getFirefoxCertificateStoreEnumerator: function()
  {
    return Cc['@mozilla.org/security/x509certdb;1']
                           .getService(Ci.nsIX509CertDB2)
                           .getCerts().getEnumerator();
  },

  isRootCertificate: function(x509certificate)
  {
	var chainArray = x509certificate.getChain();

	if (chainArray.length == 1)
	{
		return true;
	}
	else
	{
		return false;
	}
  },

  dateToTime: function(dateStr)
  {
    var time = new Date(dateStr);

    return time;
  },

  // Performs a SHA265 hash on the parameter data.
  hash: function(data)
  {
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
        createInstance(Ci.nsIScriptableUnicodeConverter);
    var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);

    ch.init(ch.SHA256);
    ch.update(data, data.length);
    var hashString = ch.finish(false);

    // convert the binary hash data to a hex string.
    return [this.toHexString(hashString.charCodeAt(i)) for (i in hashString)].join("");
  },

  getParentHash: function(x509certificate)
  {
      var certArray = x509certificate.getChain();

      if (certArray.length == 1)
          return null;

      var certEnumerator = certArray.enumerate();

      var thisCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      var parentCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);

      return parentCert.sha1Fingerprint;
  },

  // return the two-digit hexadecimal code for a byte
  toHexString: function(charCode)
  {
    return ("0" + charCode.toString(16)).slice(-2);
  },

  convertDERtoBase64: function(rawDER)
  {
    return Base64.encode(rawDER);
  },

  checkIfShowRootCertDialog: function(times)
  {
    var prefs = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefBranch);
    var prefShowCert = prefs.getIntPref("extensions.certwatch.show_root_certificate");

    if (prefShowCert == -1)
      return true;

    if (times <= prefShowCert)
      return true;

    return false;
  },

  checkIfShowIntermediateCertDialog: function(times)
  {
    var prefs = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefBranch);
    var prefShowCert = prefs.getIntPref("extensions.certwatch.show_intermediate_certificate");

    if (prefShowCert == -1)
      return true;

    if (times <= prefShowCert)
      return true;

    return false;
  },

  checkIfShowWebsiteCertDialog: function(times)
  {
    var prefs = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefBranch);
    var prefShowCert = prefs.getIntPref("extensions.certwatch.show_website_certificate");

    if (prefShowCert == -1)
      return true;

    if (times <= prefShowCert)
      return true;

    return false;
  }
};

var certType =
{
  website: 0,
  intermediate: 1,
  root: 2
};
