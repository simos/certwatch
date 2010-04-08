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
    document.getElementById("certCN").value = window.arguments[0].cert.commonName;
    document.getElementById("labelO").value = "Organization";
    document.getElementById("certO").value = window.arguments[0].cert.organization;
    document.getElementById("labelOU").value = "Organizational Unit";
    document.getElementById("certOU").value = window.arguments[0].cert.organizationalUnit;
    document.getElementById("labelSerial").value = "Serial";
    document.getElementById("certSerial").value = window.arguments[0].cert.serial;
    document.getElementById("captionIssuedBy").label = "Issued By";
    document.getElementById("labelICN").value = "Issuer Common Name";
    document.getElementById("certICN").value = window.arguments[0].cert.issuerCommonName;
    document.getElementById("labelIO").value = "Issuer Organization";
    document.getElementById("certIO").value = window.arguments[0].cert.issuerOrganization;
    document.getElementById("labelIOU").value = "Issuer Organizational Unit";
    document.getElementById("certIOU").value = window.arguments[0].cert.issuerOrganization;

    document.getElementById("captionValidity").label = "Validity";
    document.getElementById("labelIssuedOn").value = "Issued On";
    document.getElementById("certIssuedOn").value = window.arguments[0].validity.notBefore;
    document.getElementById("labelExpiresOn").value = "Expires On";
    document.getElementById("certExpiresOn").value = window.arguments[0].validity.notAfter;

    document.getElementById("captionFingerprint").label = "Fingerprints";
    document.getElementById("labelMD5").value = "MD5";
    document.getElementById("certMD5").value = window.arguments[0].cert.md5Fingerprint;
    document.getElementById("labelSHA1").value = "SHA1";
    document.getElementById("certSHA1").value = window.arguments[0].cert.sha1Fingerprint;
}

// Called once if and only if the user clicks OK
function onOK()
{
    // Return the changed arguments.
    // Notice if user clicks cancel, window.arguments[0].out remains null
    // because this function is never called
    window.arguments[0].out =
        {
            clickedOK: true,
            clickedCancel: false
            //name:   document.getElementById("name").value,
            //description:    document.getElementById("description").value,
            //enabled:    document.getElementById("enabled").checked
        };

    return true;
}

// Called once if and only if the user clicks OK
function onCancel()
{
    // Return the changed arguments.
    // Notice if user clicks cancel, window.arguments[0].out remains null
    // because this function is never called
    window.arguments[0].out =
        {
            clickedOK: false,
            clickedCancel: true
            //name:   document.getElementById("name").value,
            //description:    document.getElementById("description").value,
            //enabled:    document.getElementById("enabled").checked
        };

    return true;
}
