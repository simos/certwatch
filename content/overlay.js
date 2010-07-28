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

var CertWatch =
{
  // Initialises the object, by initialising the DB structures
  // and updating the root certificate store in the SQLite database.
  onLoad: function()
  {
    // initialization code
    this.initialized = true;
    this.bundle = document.getElementById("certwatch-strings");

    // Perform a one-off initialisation of the database file (SQLite).
    // Also, initialise the prepared SQLite statements.
    this.dbinit();

    // Creates the initial storage of the browser root certificates, or
    // compares the current set of browser root certificates with those stored.
    this.updateRootCertificates();

    // Add event listener for "DOMContentLoaded".
    var content = document.getElementById("content");
    content.addEventListener("DOMContentLoaded", this.onPageLoad, true);
  },

  // Provides the menu item under Tools.
  onMenuItemCommand: function(e)
  {
    window.openDialog("chrome://certwatch/content/options.xul", 
                      "Preferences", 
                      "chrome,titlebar,toolbar,centerscreen,modal").focus();
  },

  // Perform a one-off initialisation of the database file (SQLite).
  // Also, initialise the prepared SQLite statements.
  dbinit: function()
  {
    try
    {
      var dbFile = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD", Ci.nsIFile);
      var storage = Cc["@mozilla.org/storage/service;1"]
                    .getService(Ci.mozIStorageService);
      dbFile.append("CertWatchDB2.sqlite");

      // Does '.../CertWatchDB.sqlite' exist?
      var dbExists = dbFile.exists();

      // Open a handle to CertWatchDB.sqlite
      this.dbHandle = storage.openDatabase(dbFile);

      // CertWatchDB.sqlite first-time table creation
      if (! !!dbExists)
      {
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionCreate);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionInsert);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesRoot);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesIntermediate);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesWebsite);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVisitsWebsite);
      }

      // Create SQLite prepared statements
      this.dbSelectCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRoot);
      this.dbSelectCertsRootHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRootHash);
      this.dbSelectCertsIntermediateHash =
        this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesIntermediateHash);
      this.dbSelectCertsWebsiteHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteHash);
      this.dbSelectCertsWebsiteCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteCommonName);
      this.dbSelectVisitsCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsCommonName);
      this.dbSelectVisitsHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsHash);
      this.dbInsertCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesRoot);
      this.dbInsertCertsIntermediate =
        this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesIntermediate);
      this.dbInsertCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesWebsite);
      this.dbInsertVisits =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringVisits);
      this.dbUpdateCertsRootRemoved =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootRemoved);
      this.dbUpdateCertsRootReAdded =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootReAdded);
      this.dbUpdateCertsRootWeb =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootWeb);
      this.dbUpdateCertsIntermediateWeb =
        this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesIntermediate);
      this.dbUpdateCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesWebsites);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error initializing SQLite prepared statements: " + 
          err + " SQLite error »" + this.dbHandle.lastErrorString + " file: " +
          dbFile.path);
      backupDatabaseFile(dbFile);
    }

    if (!dbExists)
    {
      this.populateRootCertDB();
    }    
  },

  // Populates CertWatchDB.sqlite with browser's certificate store.
  // It is only invoked when Firefox runs for the first time with the CertWatch extension.
  // These are either root certificates or intermediate certificates.
  // In addition, Firefox adds (without notifying) intermediate certificates in the certificate store.
  // We save each type of certificates to the CertWatchDB.sqlite database file.
  populateRootCertDB: function()
  {
    var enumCertificateStore = CertWatchHelpers.getFirefoxCertificateStoreEnumerator();
    var countRootCerts = 0;
    var countIntermediateCerts = 0;

    try
    {
      // For each root certificate found in Firefox,
      while (enumCertificateStore.hasMoreElements())
      {
        var thisElement = enumCertificateStore.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);

        var rawDER = thisCertificate.getRawDER({});
        var hashDER = CertWatchHelpers.hash(rawDER, rawDER.length);
        var base64DER = Base64.encode(rawDER);

        var now = Date();

        if (CertWatchHelpers.isRootCertificate(thisCertificate))
        {
        	this.dbInsertCertsRoot.bindUTF8StringParameter(0, // "hashCertificate"
        	        hashDER);
        	this.dbInsertCertsRoot.bindUTF8StringParameter(1, // "derCertificate"
        	        base64DER);
        	this.dbInsertCertsRoot.bindUTF8StringParameter(2, // "commonName"
        	        thisCertificate.commonName);
        	this.dbInsertCertsRoot.bindUTF8StringParameter(3, // "organization"
        	        thisCertificate.organization);
        	this.dbInsertCertsRoot.bindUTF8StringParameter(4, // "dateAddedToCertWatch"
        	        now);

            this.dbInsertCertsRoot.execute();

            countRootCerts += 1;
        }
        else
        {
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(0, // "hashCertificate"
                    hashDER);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(1, // "derCertificate"
                    base64DER);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(2, // "commonName"
                    thisCertificate.commonName);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(3, // "organization"
                    thisCertificate.organization);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(4, // "dateAddedToCertWatch"
                    now);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(5, // "dateLastUsed"
                    null);
            this.dbInsertCertsIntermediate.bindUTF8StringParameter(6, // "hashParent"
                    "test");

            this.dbInsertCertsIntermediate.execute();

            countIntermediateCerts += 1;
        }
      }
    }
    catch (err)
    {
        throw new Error("CertWatch: Error adding Firefox certficates at init(): "+ err);
    }
    finally
    {
      this.dbInsertCertsRoot.reset();
      this.dbInsertCertsIntermediate.reset();
    }

    var params = { firefoxRootCertCount: countRootCerts, firefoxIntermediateCertCount: countIntermediateCerts };

    window.openDialog("chrome://certwatch/content/dialog-intro.xul", "certwatch-init",
		      "chrome,dialog,modal", params);
  },

  // Runs when Firefox starts up. Check for changes in the root certificate
  // DB of the browser, and updates accordingly the SQLite DB.
  // Case #
  // 1. If FirefoxDB certificate does not exist in CertWatchDB, add to CertWatchDB.
  // 2. If FirefoxDB certificate exists in CertWatchDB, mark as re-added, if needed.
  // 3. If CertWatchDB certificate does not exist in FirefoxDB, mark as removed in CertWatchDB.
  updateRootCertificates: function()
  {
    var enumRootCertificates = CertWatchHelpers.getFirefoxCertificateStoreEnumerator(); 

    var certwatchCertificates = new Array();
    var certwatchRemovals = new Array();

    try
    {
      // Fill in certwatchCertificates[] with the CertWatchDB root certificates.
      // Also record the hashes of the CertWatchDB roots that have RemovalDate.
      while (this.dbSelectCertsRoot.executeStep())
      {
        var hashCert = this.dbSelectCertsRoot.getUTF8String(0);
        var removalDate = this.dbSelectCertsRoot.getUTF8String(5);
        var readditionDate = this.dbSelectCertsRoot.getUTF8String(6);
        if (!!removalDate)
        {
          certwatchRemovals[hashCert] = 
                                        { 
                                          removed: removalDate, 
                                          readded: readditionDate 
                                        };
        }

        certwatchCertificates[hashCert] = true;
      }

      // For each certificate found in Firefox's root certificate store,
      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);
        var rawDER = thisCertificate.getRawDER({});
        var hashDER = CertWatchHelpers.hash(rawDER, rawDER.length);
        var base64DER = Base64.encode(rawDER);
        var now = Date();

        // If a new Firefox root certificate was found (due to browser update?),
        if (certwatchCertificates[hashDER] == undefined)     //         Case 1
        {
          this.dbInsertCertsRoot.bindUTF8StringParameter(0,  // "hashCertificate"
        				  hashDER);
          this.dbInsertCertsRoot.bindUTF8StringParameter(1,  // "derCertificate"
        				  Base64.encode(rawDER));
          this.dbInsertCertsRoot.bindUTF8StringParameter(2,  // "commonName"
        				  thisCertificate.commonName);
          this.dbInsertCertsRoot.bindUTF8StringParameter(3,  // "organization"
        				  thisCertificate.organization);
          this.dbInsertCertsRoot.bindUTF8StringParameter(4,  // "dateAddedToCertWatch"
        				  now);

          this.dbInsertCertsRoot.execute();

          var validity = thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { cert: thisCertificate, validity: validity };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          // Inform that a new root certificate was found in Firefox,
          window.openDialog("chrome://certwatch/content/dialog-new-root-cert.xul",
                            "certwatch-new-root-cert",
                            "chrome,dialog,modal", params, paramsOut);
        }
        else // else both CertWatchDB and Firefox have this root certificate,
        {
          //  RemovedDate(RD) ReAddedDate (RAD)                        Case 2
          // a     .              .       -> Do nothing.
          // b     x              .       -> Set ReAddedDate.
          // c     .              x       -> Should not happen.
          // d     x              x       -> If RAD<RD, Set ReAddedDate.
          if (certwatchRemovals[hashDER]) // If the RemovedDate has been set,
          {   
            if ((!certwatchRemovals[hashDER].readded && 
                  !!certwatchRemovals[hashDER].removed) ||   // If case [b] or
                  CertWatchHelpers.dateToTime(certwatchRemovals[hashDER].removed) >
                    CertWatchHelpers.dateToTime(certwatchRemovals[hashDER].readded)) // case [d],
            {
              this.dbUpdateCertsRootReAdded.params.hashCertificate = hashDER;
              this.dbUpdateCertsRootReAdded.params.dateReAddedToMozilla = now;

              this.dbUpdateCertsRootReAdded.execute();

              var validity = thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
              var params = { cert: thisCertificate, validity: validity };
              var paramsOut = { clickedAccept: false, clickedCancel: false };

              window.openDialog("chrome://certwatch/content/dialog-reinstated-root-cert.xul",
                              "certwatch-reinstated-root-cert",
                              "chrome,dialog,modal", params, paramsOut);
            }
          }

          // Delete the reference from certwatchCertificates.
          delete certwatchCertificates[hashDER];
        }
      }

      // 'certwatchCertificates' now has those remaining CertWatchDB certificates
      //                                         that are missing from Firefox.
      for (hashCert in certwatchCertificates)
      {
        //   RemovedDate-RD     ReAddedDate-RAD                  Case 3 Matrix
        // a      .                .       -> Set RemovedDate.
        // b      x                .       -> Do nothing.
        // c      .                x       -> Should not happen.
        // d      x                x       -> If RAD > RD, Set RemovedDate.
        if (!certwatchRemovals[hashCert] ||   // case [a]
            CertWatchHelpers.dateToTime(certwatchRemovals[hashCert].readded) >
              CertWatchHelpers.dateToTime(certwatchRemovals[hashCert].removed)) // case [d]
          {
            this.dbUpdateCertsRootRemoved.params.hashCertificate = hashCert;
            this.dbUpdateCertsRootRemoved.params.dateRemovedFromMozilla = now;

            this.dbUpdateCertsRootRemoved.execute();

            /* Prepare to search for hashCert cert in CertWatchDB */
            this.dbSelectCertsRootHash.params.hash = hashCert;

            if (this.dbSelectCertsRootHash.executeStep())
            {
              var removedCertBase64 = this.dbSelectCertsRootHash.getUTF8String(1);
              var removedCertificate = CertWatchHelpers.convertBase64CertToX509(removedCertBase64);
              var validity = removedCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
              var params = { cert: removedCertificate, validity: validity };
              var paramsOut = { clickedAccept: false, clickedCancel: false };

              window.openDialog("chrome://certwatch/content/dialog-removed-root-cert.xul",
                                "certwatch-removed-root-cert",
                                "chrome,dialog,modal", params, paramsOut);
            }

            this.dbSelectCertsRootHash.reset();
          }
      }
    }
    catch (err)
    {
      throw new Error("CertWatch: Error updating root certificates: "+ err);
    }
    finally
    {
      this.dbSelectCertsRoot.reset();
      this.dbSelectCertsRootHash.reset();
      this.dbUpdateCertsRootRemoved.reset();
    }
  },

  // Invoked through the "DOMContentLoaded" event.
  onPageLoad: function(aEvent)
  {
    var doc = aEvent.originalTarget;
    if (doc.location.protocol == "https:")
    {
      CertWatch.onSecurePageLoad(doc);
    }
  },

  // Invoked when an https page is loaded.
  // We use the same way now as Certificate Patrol does.
  // TODO: Investigate whether to hook into the SSL/TLS component of NSS.
  //       During tests, hooking to NSS brings about six hits per https 
  //       document loaded. (possibly due to not pipelining?)
  // TODO: If the user switches tabs too quickly, this method has the side-effect
  //       of recording the wrong page details. A bit rare; needs investigation.
  onSecurePageLoad: function(doc)
  {
    var serverCert;
    var validity;

    // Finds the right tab that issues the SecurePageLoad event.
    // We then load the corresponding securityUI for this event.
    var browser = gBrowser.getBrowserForDocument(doc);
    if (!browser)
      return

    var securityUI = browser.securityUI;
    if (!securityUI)
      return;

    var sslStatusProvider = securityUI.QueryInterface(Ci.nsISSLStatusProvider);
    if (!sslStatusProvider)
      return;

    var sslStatus = sslStatusProvider.SSLStatus;
    if (!sslStatus)
      return;

    var sslStatusStruct = sslStatus.QueryInterface(Ci.nsISSLStatus);
    if (!sslStatusStruct)
      return;

    serverCert = sslStatusStruct.serverCert;
    if (!serverCert)
      return;

    validity = serverCert.validity.QueryInterface(Ci.nsIX509CertValidity);
    if (!validity)
      return;

    var certArray = serverCert.getChain();
    var certEnumerator = certArray.enumerate();

    var chainCerts = new Array();
    var rawDER, hashDER, base64DER;
    var rawDERParent, hashDERParent, base64DERParent;
    var count = 0;
    var i;
    
    while (certEnumerator.hasMoreElements())
    {
      chainCerts[count] = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      count++;
    }

    // This is for element 0 of chainCerts, the website certificate in the chain.
    //
    // TODO: is there an alternative way to establish which is the website
    // certificate? Use ASN.1.
    rawDER = chainCerts[0].getRawDER({});
    [hashDER, base64DER] = CertWatchHelpers.processDER(rawDER);
    rawDERParent = chainCerts[1].getRawDER({});
    [hashDERParent, base64DERParent] = CertWatchHelpers.processDER(rawDERParent);

    this.doWebsiteCertificateWasAccessed(hashDER,
                                         chainCerts[0],
                                         base64DER,
                                         gBrowser.contentDocument.URL,
                                         hashDERParent);
    this.doAddWebsiteVisit(hashDER,
                           chainCerts[0].commonName,
                           gBrowser.contentDocument.URL,
                           gBrowser.contentDocument.referrer);
    
    // Deal with the intermediate certificates.
    for (i = 1; i < count - 1; i++)
    {
      rawDER = chainCerts[i].getRawDER({});
      [hashDER, base64DER] = CertWatchHelpers.processDER(rawDER);
      rawDERParent = chainCerts[i+1].getRawDER({});
      [hashDERParent, base64DERParent] = CertWatchHelpers.processDER(rawDERParent);

      this.doIntermediateCertificateWasAccessed(hashDER, 
                                          base64DER, 
                                          chainCerts[i], 
                                          gBrowser.contentDocument.URL,
                                          hashDERParent);
    }

    rawDER = chainCerts[count-1].getRawDER({});
    [hashDER, base64DER] = CertWatchHelpers.processDER(rawDER);

    this.doRootCertificateWasAccessed(hashDER, 
                                      base64DER, 
                                      chainCerts[count-1], 
                                      gBrowser.contentDocument.URL);
  },

  // Case: the user visited a secure website which references root cert 'hashDER'.
  //   	Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for hashDER. Cache the results.
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  // The root certificate is the last certificate in the certificate chain.
  doRootCertificateWasAccessed: function(hashDER, base64DER, cert, URL)
  {
    try
    {
      this.dbSelectCertsRootHash.params.hash = hashDER;

      // If known root certificate,
      if (this.dbSelectCertsRootHash.executeStep())
      {
        var now = Date();

        var storedRootCertFirstUsed = this.dbSelectCertsRootHash.getUTF8String(7);
        var storedRootCertLastUsed  = this.dbSelectCertsRootHash.getUTF8String(8);
        var storedRootCertTimesUsed = this.dbSelectCertsRootHash.getInt64(9);
        var storedRootCertFirstNull = this.dbSelectCertsRootHash.getIsNull(7);

        this.dbUpdateCertsRootWeb.params.hashCertificate = hashDER;

        this.dbUpdateCertsRootWeb.params.countTimesUsed = storedRootCertTimesUsed + 1;
        
        if (storedRootCertFirstNull)
        {
          this.dbUpdateCertsRootWeb.params.dateFirstUsed = now;
        }
        else
        {
          this.dbUpdateCertsRootWeb.params.dateFirstUsed = storedRootCertFirstUsed;
        }
        this.dbUpdateCertsRootWeb.params.dateLastUsed = now;

        this.dbUpdateCertsRootWeb.execute();

        if (this.checkIfShowRootCertDialog(storedRootCertTimesUsed + 1))
        {
          var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { URL: URL, cert: cert, validity: validity, 
                         timesAccessed: storedRootCertTimesUsed + 1 };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          window.openDialog("chrome://certwatch/content/dialog-root-access.xul",
                            "certwatch-root-access",
                            "chrome,dialog,modal", params, paramsOut);
        }
      }
      else
      {
        alert("Unknown root certificate found: " + cert.commonName);
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doRootCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsRootHash.reset();
      this.dbUpdateCertsRootWeb.reset();
    }
  },

  // Case: the user visited a secure website which references root cert 'hashDER'.
  //    Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for hashDER. Cache the results
  // 2. Update the rootCert data for said certificate.
  //    dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //    dateLastUsed -> current timedate.
  //    countTimesUsed -> +1
  doIntermediateCertificateWasAccessed: function(hashDER, base64DER, cert, URL, hashParent)
  {
    try
    {
      var now = Date();

      this.dbSelectCertsIntermediateHash.params.hash = hashDER;

      if (this.dbSelectCertsIntermediateHash.executeStep())
      {
        var storedIntermediateCertTimesUsed = this.dbSelectCertsIntermediateHash.getInt64(6);

        this.dbUpdateCertsIntermediateWeb.params.hashCertificate = hashDER;

        this.dbUpdateCertsIntermediateWeb.params.countTimesUsed = storedIntermediateCertTimesUsed + 1;
        this.dbUpdateCertsIntermediateWeb.params.dateLastUsed = now;

        this.dbUpdateCertsIntermediateWeb.execute();

        if (this.checkIfShowRootCertDialog(storedIntermediateCertTimesUsed + 1))
        {
          var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { URL: URL, cert: cert, validity: validity, 
                         timesAccessed: storedIntermediateCertTimesUsed + 1 };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          window.openDialog("chrome://certwatch/content/dialog-intermediate-access.xul",
                            "certwatch-intermediate-access",
                            "chrome,dialog,modal", params, paramsOut);
        }
      }
      else  // Else, it is a new intermediate certificate.
      {
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(0, hashDER);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(1, base64DER);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(2, cert.commonName);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(3, cert.organization);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(4, now);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(5, now);
        this.dbInsertCertsIntermediate.bindUTF8StringParameter(6, hashParent);

        this.dbInsertCertsIntermediate.execute();

        if (this.checkIfShowRootCertDialog(1))
        {
          var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { URL: URL, cert: cert, validity: validity, 
                         timesAccessed: 1 };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          window.openDialog("chrome://certwatch/content/dialog-intermediate-access.xul",
                            "certwatch-intermediate-access",
                            "chrome,dialog,modal", params, paramsOut);
        }
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doIntermediateCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsIntermediateHash.reset();
      this.dbUpdateCertsIntermediateWeb.reset();
    }
  },
  
  // Case: the user visited a secure website with certificate hash 'hashDER'.
  // 1. Search root certs (in SQLite DB) for hashDER. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doWebsiteCertificateWasAccessed: function(hashDER, cert, base64DER, URL, hashParent)
  {
    var now = Date();

    try
    {
      this.dbSelectCertsWebsiteHash.params.hash = hashDER;

      if (this.dbSelectCertsWebsiteHash.executeStep())
      {
        var storedWebsiteFirstVisit = this.dbSelectCertsWebsiteHash.getUTF8String(3);
        var storedWebsiteLastVisit  = this.dbSelectCertsWebsiteHash.getUTF8String(4);
        var storedWebsiteTimesVisited = this.dbSelectCertsWebsiteHash.getInt64(5);
        var storedWebsiteFirstNull = this.dbSelectCertsWebsiteHash.getIsNull(3);

        this.dbUpdateCertsWebsite.params.hashCertificate = hashDER;

        this.dbUpdateCertsWebsite.params.countTimesVisited = storedWebsiteTimesVisited + 1;
        if (storedWebsiteFirstNull)
        {
          this.dbUpdateCertsWebsite.params.dateFirstVisit = now;
        }
        else
        {
          this.dbUpdateCertsWebsite.params.dateFirstVisit = storedWebsiteFirstVisit;
        }
        this.dbUpdateCertsWebsite.params.dateLastVisit = now;

        this.dbUpdateCertsWebsite.execute();

        if (this.checkIfShowWebsiteCertDialog(storedWebsiteTimesVisited + 1))
        {
          var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { URL: URL, cert: cert, validity: validity, 
                         firstTime: false, timesAccessed: storedWebsiteTimesVisited + 1 };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                            "certwatch-website-access",
                            "chrome,dialog,modal", params, paramsOut);
        }
      }
      else
      {
        this.dbInsertCertsWebsite.bindUTF8StringParameter(0, hashDER);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(1, base64DER);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(2, cert.commonName);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(3, now);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(4, now);
        this.dbInsertCertsWebsite.bindInt64Parameter(5, 1);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(6, hashParent);

        this.dbInsertCertsWebsite.execute();

        if (this.checkIfShowWebsiteCertDialog(1))
        {
          var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { URL: URL, cert: cert, validity: validity, 
                       firstTime: true, timesAccessed: -1 };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                            "certwatch-website-access",
                            "chrome,dialog,modal", params, paramsOut);
        }
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doWebsiteCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsWebsiteHash.reset();
      this.dbInsertCertsWebsite.reset();
      this.dbUpdateCertsWebsite.reset();
    }
  },

  // Case: the user visited a secure website.
  // 1. Add an entry to Visits table,
  //		canonicalName -> as reported by the certificate.
  //		hashCertificate -> hash of DER of website certificate.
  //		timedate of visit -> `now`.
  //		URL -> full URL of website.
  //		Referer -> referer, if any.
  doAddWebsiteVisit: function(hashDER, CN, URL, REFERER)
  {
    var now = Date();

    try
    {
      this.dbInsertVisits.bindUTF8StringParameter(0, CN);
      this.dbInsertVisits.bindUTF8StringParameter(1, hashDER);
      this.dbInsertVisits.bindUTF8StringParameter(2, now);
      this.dbInsertVisits.bindUTF8StringParameter(3, URL);
      this.dbInsertVisits.bindUTF8StringParameter(4, REFERER);

      this.dbInsertVisits.execute();
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doAddWebsiteVisit: "+ err);
    }
    finally
    {
      this.dbInsertVisits.reset();
    }
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

window.addEventListener("load", function(e) { CertWatch.onLoad(e); }, false);
