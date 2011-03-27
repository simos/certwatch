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
    var bundle = document.getElementById("certwatch-strings");

    var description = bundle.getFormattedString("DialogRemovedRootCert.Description", [window.arguments[0].currentCert, window.arguments[0].totalCerts], 2);
    document.getElementById("dialogRemovedRootCert").setAttribute("description", description);

    // Use the arguments passed to us by the caller
    setLabel("captionIssuedTo", bundle.getString("IssuedTo"));
    setValue("labelCN", bundle.getString("CommonName"));
    setValue("certCN", window.arguments[0].cert.commonName);
    setValue("labelO", bundle.getString("Organization"));
    setValue("certO", window.arguments[0].cert.organization);
    setValue("labelOU", bundle.getString("OrganizationalUnit"));
    setValue("certOU", window.arguments[0].cert.organizationalUnit);
    setValue("labelSerial", bundle.getString("Serial"));
    setValue("certSerial", window.arguments[0].cert.serialNumber);
    setLabel("captionIssuedBy", bundle.getString("IssuedBy"));
    setValue("labelICN", bundle.getString("IssuerCommonName"));
    setValue("certICN", window.arguments[0].cert.issuerCommonName);
    setValue("labelIO", bundle.getString("IssuerOrganization"));
    setValue("certIO", window.arguments[0].cert.issuerOrganization);
    setValue("labelIOU", bundle.getString("IssuerOrganizationalUnit"));
    setValue("certIOU", window.arguments[0].cert.issuerOrganizationUnit);

    setLabel("captionValidity", bundle.getString("Validity"));
    setValue("labelIssuedOn", bundle.getString("IssuedOn"));
    setValidity("certIssuedOn", window.arguments[0].validity.notBefore);
    setValue("labelExpiresOn", bundle.getString("ExpiresOn"));
    setValidity("certExpiresOn", window.arguments[0].validity.notAfter);

    setLabel("captionFingerprint", bundle.getString("Fingerprint"));
    setValue("labelSHA1", bundle.getString("SHA1"));
    setValue("certSHA1", window.arguments[0].cert.sha1Fingerprint);
}

// Called once if and only if the user clicks OK
function onAccept()
{
  // Return the changed arguments.
  window.arguments[1].clickedAccept = true;

  return true;
}

// Called once if and only if the user clicks OK
function onCancel()
{
  // Return the changed arguments.
  window.arguments[1].clickedCancel = true;

  return true;
}
