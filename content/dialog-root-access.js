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

// Called once when the dialog displays
function onLoad()
{
    // Use the arguments passed to us by the caller
    document.getElementById("URL").value = window.arguments[0].URL;
    document.getElementById("captionIssuedTo").label = "Issued To";
    document.getElementById("labelCN").value = "Common Name";
    setValue("certCN", window.arguments[0].cert.commonName);
    document.getElementById("labelO").value = "Organization";
    setValue("certO", window.arguments[0].cert.organization);
    document.getElementById("labelOU").value = "Organizational Unit";
    setValue("certOU", window.arguments[0].cert.organizationalUnit);
    document.getElementById("labelSerial").value = "Serial";
    setValue("certSerial", window.arguments[0].cert.serial);
    document.getElementById("captionIssuedBy").label = "Issued By";
    document.getElementById("labelICN").value = "Issuer Common Name";
    setValue("certICN", window.arguments[0].cert.issuerCommonName);
    document.getElementById("labelIO").value = "Issuer Organization";
    setValue("certIO", window.arguments[0].cert.issuerOrganization);
    document.getElementById("labelIOU").value = "Issuer Organizational Unit";
    setValue("certIOU", window.arguments[0].cert.issuerOrganization);

    document.getElementById("captionValidity").label = "Validity";
    document.getElementById("labelIssuedOn").value = "Issued On";
    var validityNotBefore = new Date(window.arguments[0].validity.notBefore/1000);
    document.getElementById("certIssuedOn").value = validityNotBefore.toLocaleString();
    document.getElementById("labelExpiresOn").value = "Expires On";
    var validityNotAfter = new Date(window.arguments[0].validity.notAfter/1000);
    document.getElementById("certExpiresOn").value = validityNotAfter.toLocaleString();

    document.getElementById("captionFingerprint").label = "Fingerprints";
    document.getElementById("labelMD5").value = "MD5";
    document.getElementById("certMD5").value = window.arguments[0].cert.md5Fingerprint;
    document.getElementById("labelSHA1").value = "SHA1";
    document.getElementById("certSHA1").value = window.arguments[0].cert.sha1Fingerprint;
}

function setValue(arg, val)
{
  if (!!val)
  {
    document.getElementById(arg).value = val
  }
  else
  {
    document.getElementById(arg).value = "empty";
    document.getElementById(arg).disabled = true;
  }
}

// Called once if and only if the user clicks OK
function onAccept()
{
  // Return the changed arguments.
  window.arguments[1].clickedOK = true;

  return true;
}

// Called once if and only if the user clicks OK
function onCancel()
{
  // Return the changed arguments.
  window.arguments[1].clickedCancel = true;

  return true;
}
