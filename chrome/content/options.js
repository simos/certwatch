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

const Cc = Components.classes;
const Ci = Components.interfaces;

function onPaneLoad()
{
  var prefsArrayRoot = new Array();
  var prefsArrayIntermediate = new Array();
  var prefsArrayWebsite = new Array();

  prefsArrayRoot[0] = [0, 'itemR0'];
  prefsArrayRoot[1] = [1, 'itemR1'];
  prefsArrayRoot[2] = [2, 'itemR2'];
  prefsArrayRoot[3] = [3, 'itemR3'];
  prefsArrayRoot[5] = [4, 'itemR5'];
  prefsArrayRoot[10] = [5, 'itemR10'];
  prefsArrayRoot[20] = [6, 'itemR20'];
  prefsArrayRoot[-1] = [7, 'itemRM1'];

  prefsArrayIntermediate[0] = [0, 'itemI0'];
  prefsArrayIntermediate[1] = [1, 'itemI1'];
  prefsArrayIntermediate[2] = [2, 'itemI2'];
  prefsArrayIntermediate[3] = [3, 'itemI3'];
  prefsArrayIntermediate[5] = [4, 'itemI5'];
  prefsArrayIntermediate[10] = [5, 'itemI10'];
  prefsArrayIntermediate[20] = [6, 'itemI20'];
  prefsArrayIntermediate[-1] = [7, 'itemIM1'];

  prefsArrayWebsite[0] = [0, 'itemW0'];
  prefsArrayWebsite[1] = [1, 'itemW1'];
  prefsArrayWebsite[2] = [2, 'itemW2'];
  prefsArrayWebsite[3] = [3, 'itemW3'];
  prefsArrayWebsite[5] = [4, 'itemW5'];
  prefsArrayWebsite[10] = [5, 'itemW10'];
  prefsArrayWebsite[20] = [6, 'itemW20'];
  prefsArrayWebsite[-1] = [7, 'itemWM1'];

  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  var prefShowRootCert = prefs.getIntPref("extensions.certwatch.show_root_certificate");
  var prefShowIntermediateCert = prefs.getIntPref("extensions.certwatch.show_intermediate_certificate");
  var prefShowWebsiteCert = prefs.getIntPref("extensions.certwatch.show_website_certificate");

  var menulistRoot = document.getElementById("menulistRoot");
  var menulistIntermediate = document.getElementById("menulistIntermediate");
  var menuitemWebsite = document.getElementById("menulistWebsite");

  menulistRoot.selectedIndex = prefsArrayRoot[prefShowRootCert][0];
  menulistIntermediate.selectedIndex = prefsArrayIntermediate[prefShowIntermediateCert][0];
  menuitemWebsite.selectedIndex = prefsArrayWebsite[prefShowWebsiteCert][0];
};

function onSelectRoot(times)
{
  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  prefs.setIntPref("extensions.certwatch.show_root_certificate", times);
};

function onSelectIntermediate(times)
{
  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  prefs.setIntPref("extensions.certwatch.show_intermediate_certificate", times);
};

function onSelectWebsite(times)
{
  var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);

  prefs.setIntPref("extensions.certwatch.show_website_certificate", times);
};
