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

function setLabel(arg, val)
{
  document.getElementById(arg).label = val;
}

function setValue(arg, val)
{
  var bundle = document.getElementById("certwatch-strings");

  if (!!val)
  {
    document.getElementById(arg).value = val;
  }
  else
  {
    document.getElementById(arg).value = bundle.getString("empty");
    document.getElementById(arg).disabled = true;
  }
}

function setValidity(arg, val)
{
  var nowDate = new Date();
  var validityDate = new Date(val/1000);
  var diff = nowDate.getTime() - validityDate.getTime();

  var inPast = true;
  var humanReadable;

  var bundle = document.getElementById("certwatch-strings");

  if (diff < 0)       // Validity is in the future (it is an expiry date)
  {
    diff = Math.abs(diff);
    inPast = false;
  }

  if (Math.round(diff/1000/60/60/24/365) >= 2)
    humanReadable = bundle.getFormattedString(inPast?
                      "validityYearsPast":
                      "validityYearsFuture",
                      [Math.round(diff/1000/60/60/24/365)],
                      1);
  else if (diff/1000/60/60/24 >= 365)
    humanReadable = bundle.getString(inPast?
                      "validityAYearPast":
                      "validityAYearFuture");
  else if (diff/1000/60/60/24 > 60)
    humanReadable = bundle.getFormattedString(inPast?
                      "validityMonthsPast":
                      "validityMonthsFuture",
                      [Math.round(diff/1000/60/60/24/30)],
                      1);
  else if (diff/1000/60/60/24 > 30)
    humanReadable = bundle.getFormattedString(inPast?
                      "validityMonthandDaysPast":
                      "validityMonthandDaysFuture",
                      [Math.abs(Math.round(diff/1000/60/60/24/30) - 30)],
                      1);
  else if (diff/1000/60/60/24 > 1)
    humanReadable = bundle.getFormattedString(inPast?
                      "validityDaysPast":
                      "validityDaysFuture",
                      [Math.round(diff/1000/60/60/24)],
                      1);
  else if (Math.round(diff/1000/60/60/24) == 1)
    humanReadable = bundle.getString(inPast?
                      "validityADayPast":
                      "validityADayFuture");
  else
    humanReadable = bundle.getString("validityToday");

  setValue(arg, validityDate.toLocaleString() + "  (" + humanReadable + ")");
}

