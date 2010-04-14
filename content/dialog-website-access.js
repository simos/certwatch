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
    if (window.arguments[0].firstTime)
    {
        setValue("descWebsiteCertAccess", 
        "The following website certificate was accessed for the first time while visiting the URL:");
    }
    else
    {
        setValue("descWebsiteCertAccess", 
        "The following website certificate was accessed while visiting the URL:");
    }
    setValue("URL", window.arguments[0].URL);
    setLabel("captionIssuedTo", "Issued To");
    setValue("labelCN", "Common Name");
    setValue("certCN", window.arguments[0].cert.commonName);
    setValue("labelO", "Organization");
    setValue("certO", window.arguments[0].cert.organization);
    setValue("labelOU", "Organizational Unit");
    setValue("certOU", window.arguments[0].cert.organizationalUnit);
    setValue("labelSerial", "Serial");
    setValue("certSerial", window.arguments[0].cert.serial);
    setLabel("captionIssuedBy", "Issued By");
    setValue("labelICN", "Issuer Common Name");
    setValue("certICN", window.arguments[0].cert.issuerCommonName);
    setValue("labelIO", "Issuer Organization");
    setValue("certIO", window.arguments[0].cert.issuerOrganization);
    setValue("labelIOU", "Issuer Organizational Unit");
    setValue("certIOU", window.arguments[0].cert.issuerOrganization);

    setLabel("captionValidity", "Validity");
    setValue("labelIssuedOn", "Issued On");
    setValidity("certIssuedOn", window.arguments[0].validity.notBefore);
    setValue("labelExpiresOn", "Expires On");
    setValidity("certExpiresOn", window.arguments[0].validity.notAfter);

    setLabel("captionFingerprint", "Fingerprints");
    setValue("labelMD5", "MD5");
    setValue("certMD5", window.arguments[0].cert.md5Fingerprint);
    setValue("labelSHA1", "SHA1");
    setValue("certSHA1", window.arguments[0].cert.sha1Fingerprint);
}

function setLabel(arg, val)
{
  document.getElementById(arg).label = val;
}

function setValue(arg, val)
{
  if (!!val)
  {
    document.getElementById(arg).value = val;
  }
  else
  {
    document.getElementById(arg).value = "empty";
    document.getElementById(arg).disabled = true;
  }
}

function setValidity(arg, val)
{
  var now = new Date();
  var validity = new Date(val/1000);
  var localeDate = validity.toLocaleString();
  var humanReadable;
  
  if (now.getFullYear() - validity.getFullYear() > 1)
    humanReadable = sprintf("About %d years ago", now.getFullYear() - validity.getFullYear());
  else if (validity.getFullYear() - now.getFullYear() > 1)
    humanReadable = sprintf("In about %d years", validity.getFullYear() - now.getFullYear());
  else if (now.getFullYear() - validity.getFullYear() == 1)
    humanReadable = "About a year ago";
  else if (validity.getFullYear() - now.getFullYear() == 1)
    humanReadable = "In a bit more than a year";
  else if (now.getMonth() - validity.getMonth() > 2)
    humanReadable = sprintf("About %d months ago", now.getMonth() - validity.getMonth());
  else if (validity.getMonth() - now.getMonth() > 2)
    humanReadable = sprintf("In %d months", validity.getMonth() - now.getMonth());
  else if (now.getDay() - validity.getDay() > 0)
    humanReadable = sprintf("%d days ago", now.getDay() - validity.getDay());
  else if (validity.getDay() - now.getDay() > 0)
    humanReadable = sprintf("In %d days", validity.getDay() - now.getDay());
  else if (validity.getDay() - now.getDay() == 0)
    humanReadable = "Today";
  else
    humanReadable = "EXPIRED";
  
  setValue(arg, localeDate + "  (" + humanReadable + ")");
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
