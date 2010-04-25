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

var Cc = Components.classes;
var Ci = Components.interfaces;

function onPaneLoad()
{
  var prefsArray = new Array();
  
  prefsArray[0] = ['item0', 0, "Never"];
  prefsArray[1] = ['item1', 1, "First time only"];
  prefsArray[2] = ['item2', 2, "… two times only"];
  prefsArray[3] = ['item3', 3, "… three times only"];
  prefsArray[4] = ['item5', 5, "… five times only"];
  prefsArray[5] = ['item10', 10, "… ten times only"];
  prefsArray[6] = ['item20', 20, "… twenty times only"];
  prefsArray[7] = ['itemM1', -1, "Always"];
  
  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  var prefShowRootCert = prefs.getIntPref("extensions.certwatch.show_root_certificate");
  var prefShowWebsiteCert = prefs.getIntPref("extensions.certwatch.show_website_certificate");
  
  var menupopupRoot = document.getElementById("menuPopupRoot");
  var menupopupWebsite = document.getElementById("menuPopupWebsite");
  
  for (var i = 0; i < prefsArray.length; i++)
  {
    addPopupItem(menupopupRoot, prefsArray[i][0], 
                                prefsArray[i][1], 
                                prefsArray[i][2], 
                                prefShowRootCert);
    addPopupItem(menupopupWebsite, 
                                prefsArray[i][0],
                                prefsArray[i][1], 
                                prefsArray[i][2],
                                prefShowWebsiteCert);
  }
}

function addPopupItem(menupopup, id, value, label, selected)
{
  
  alert("id: " + id + " value: " + value + " label: " + label + " selected: " + selected);
  var newMenuItem = document.createElement("menuitem");

  newMenuItem.setAttribute("id", id);
  newMenuItem.setAttribute("label", label);
  newMenuItem.setAttribute("oncommand", 'onSelectRoot(' + id + ');');

  menupopup.appendChild(newMenuItem);

  if (value == selected)
  {
    // newMenuItem.setAttribute("selected", true);
    menupopup.selectedItem = id;
  }
}

function onSelectRoot(times)
{
  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  prefs.getIntPref("extensions.certwatch.show_root_certificate");
  alert("Got " + times);
}
