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
    var serverCert = window.arguments[0].cert;
    var URL = window.arguments[0].URL;

    var chainCerts = window.arguments[0].chainCerts;
    var rawDER, hashCert, base64DER;
    var rawDERParent, hashCertParent, base64DERParent;
    var count = 0;
    var i;

    var certTypes = ["website", "intermediate1", "intermediate2", "intermediate3", "intermediate4", "intermediate5", "root"];
    var MAXCHAIN = 7;
    var theseCertTypes = [];
    var type;
    var certIndex = 0;

    var characterSpecial;

    // Stock Windows XP do not have the star Unicode character.
    if (navigator.oscpu == "Windows NT 5.1")
        characterSpecial = "●";
    else
        characterSpecial = "★";

    var description = bundle.getString("DialogCertificateAccess.Description");
    document.getElementById("dialogCertificateAccess").setAttribute("description", description);

    setValue("URL", URL);

    for (i = 0; i < MAXCHAIN; i++)
    {
        document.getElementById("tab-" + certTypes[i]).setAttribute("hidden", "true");
    }


    if (chainCerts.length == 0)
        alert("Certificate chain has length zero; unexpected; contact developers");
    else if (chainCerts.length == 1)
        {
            theseCertTypes = certTypes[0];
            document.getElementById("tab-" + certTypes[0]).setAttribute("hidden", "false");
        }
    else if (chainCerts.length == 2)
        {
            theseCertTypes = [certTypes[0], certTypes[6]];

            document.getElementById("tab-" + certTypes[0]).setAttribute("hidden", "false");
            document.getElementById("tab-" + certTypes[MAXCHAIN - 1]).setAttribute("hidden", "false");
        }
    else if (chainCerts.length < 8)
        {
            for (i = 0; i < chainCerts.length - 1; i++)
                theseCertTypes.push(certTypes[i]);

            theseCertTypes.push(certTypes[6]);

            for (i = 0; i < chainCerts.length - 1; i++)
                {
                    document.getElementById("tab-" + certTypes[i]).setAttribute("hidden", "false");
                }
            document.getElementById("tab-" + certTypes[MAXCHAIN - 1]).setAttribute("hidden", "false");
        }
    else
        alert("Certificate chain has length longer than seven; unable to display; contact developers");

    for (i in theseCertTypes)
    {
        var oldlabel = document.getElementById("tab-" + theseCertTypes[i]).getAttribute("label");
        var timesAccessed = chainCerts[certIndex].timesAccessed;

        document.getElementById("tab-" + theseCertTypes[i]).setAttribute("label", oldlabel +
                " (" + timesAccessed + ((chainCerts[certIndex].mustShow)? characterSpecial : "") + ")");

        setValue("certCN-" + theseCertTypes[i],              chainCerts[certIndex].cert.commonName);
        setValue("certO-" + theseCertTypes[i],               chainCerts[certIndex].cert.organization);
        setValue("certOU-" + theseCertTypes[i],              chainCerts[certIndex].cert.organizationalUnit);
        setValue("certSerial-" + theseCertTypes[i],          chainCerts[certIndex].cert.serialNumber);
        if (theseCertTypes[i] != "root")
        {
            setValue("certICN-" + theseCertTypes[i],             chainCerts[certIndex].cert.issuerCommonName);
            setValue("certIO-" + theseCertTypes[i],              chainCerts[certIndex].cert.issuerOrganization);
            setValue("certIOU-" + theseCertTypes[i],             chainCerts[certIndex].cert.issuerOrganizationUnit);
        }
        setValidity("certIssuedOn-" + theseCertTypes[i],     chainCerts[certIndex].cert.validity.notBefore);
        setValidity("certExpiresOn-" + theseCertTypes[i],    chainCerts[certIndex].cert.validity.notAfter);
        setValue("certSHA1-" + theseCertTypes[i],            chainCerts[certIndex].cert.sha1Fingerprint);

        certIndex += 1;
    }
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
