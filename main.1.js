/**************************************************************************
*   Amarok 2 lyrics script to fetch lyrics from lyrics.wikia.com          *
*   (formerly lyricwiki.org)                                              *
*                                                                         *
*   Copyright                                                             *
*   (C) 2008 Aaron Reichman <reldruh@gmail.com>                           *
*   (C) 2008 Leo Franchi <lfranchi@kde.org>                               *
*   (C) 2008 Mark Kretschmann <kretschmann@kde.org>                       *
*   (C) 2008 Peter ZHOU <peterzhoulei@gmail.org>                          *
*   (C) 2009 Jakob Kummerow <jakob.kummerow@gmail.com>                    *
*   (C) 2011 Swapan Sarkar  <swapan@yahoo.com>                            *
*                                                                         *
*   This program is free software; you can redistribute it and/or modify  *
*   it under the terms of the GNU General Public License as published by  *
*   the Free Software Foundation; either version 2 of the License, or     *
*   (at your option) any later version.                                   *
*                                                                         *
*   This program is distributed in the hope that it will be useful,       *
*   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
*   GNU General Public License for more details.                          *
*                                                                         *
*   You should have received a copy of the GNU General Public License     *
*   along with this program; if not, write to the                         *
*   Free Software Foundation, Inc.,                                       *
*   51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.         *
**************************************************************************/

Importer.loadQtBinding( "qt.core" );
Importer.loadQtBinding( "qt.xml" );
Importer.include( "hitrans.js" );

/* GLOBAL VARIABLES */
// template for the xml object that will be populated and passed to Amarok.Lyrics.showLyrics()
XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?><lyric artist=\"{artist}\" title=\"{title}\">{lyrics}</lyric>";
HTML = "<!DOCTYPE html><html><head><title>{TITLE}</title></head><body style=\"color:#000\">{body}</body></html>";
BODY = "<table border=\"0\" cellpadding=\"3\" style=\"margin-left:2em;margin-right:2em\"> <tr><td width=50\%>Song: {title} </td><td width=40\%>From: {album} </td><td> {year} </td></tr> <tr><td>Music Director: {composer} </td><td colspan=2>Lyrics: {lyricist}</td></tr> <tr><td colspan=3>Singers: {singer} </td></tr> </table><hr/><p> {lyrics} </p><hr/><div style=\"margin-left:1em\">{links}</div>";
// if we change variable xml it will not reinitialized on next lyrics request, so we will get lyrics from previous song
// because of that we need temp variable
NEWXML = NEWHTML = "";
// maximum numbers that we can follow by #REDIRECT [[Band:Song]]
MAXREDIRECTS = 3;
// url to get lyrics using mediawiki API
WIKIAURL = "http://lyrics.wikia.com/api.php?action=query&prop=revisions&rvprop=content&format=xml&titles=";
GEETURL = "http://giitaayan.com/search.asp?browse=stitle&s=#{title}&submit=search";
// urlified artist and title will be here after initialization
ARTIST = "";
TITLE  = "";
// the error message that is displayed if no lyrics were found or there was an error while trying to fetch them
ERRORMSG = "Lyrics not found. Sorry.";


/* receives a Wiki page (in XML format) that contains url to lyric of the requested song
   this API function can correct our tags
   for example we trying to receive lyrics for Nightwish:Nightwish_-_Sleepwalker (incorrect tags)
   this API functions will redirect us to Nightwish:Sleepwalker (correct tags)
*/
function onHelpReceived( response )
{
    try
    {
        if( response.length == 0 )
            Amarok.Lyrics.showLyricsError( ERRORMSG );
        else
        {
            var doc = new QDomDocument();
            doc.setContent(response);
              
            var urlstr = doc.elementsByTagName( "url" ).at( 0 ).toElement().text();
            var capture;
                 
            if(capture = /.+\/([^?=:]+:[^?=:]+)$/.exec(urlstr))
            {
                  // matched url is like this one: http://lyrics.wikia.com/Nightwish:Sleepwalker
                  // but not like this: http://lyrics.wikia.com/index.php?title=Nightwish:Sleepwalker&action=edit
                      
                  var url = QUrl.fromEncoded( new QByteArray( WIKIAURL + capture[1] ), 1);
                                                         // this zero will not allow to execute this function again
                  new Downloader( url, new Function("response", "onLyricsReceived(response, 0)") );
            }
            else
            {
                  Amarok.Lyrics.showLyricsNotFound( ERRORMSG );
            }
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onHelpReceived: " + err );
    }
}

/* receives a Wiki page (in XML format) using wikimedia API and extracts lyrics from it */
function onLyricsReceived( response, redirects )
{
    try
    {
        if( response.length == 0 )
            Amarok.Lyrics.showLyricsError( "Unable to contact server - no website returned" ); // TODO: this should be i18n able
        else
        {
            var doc = new QDomDocument();
            doc.setContent(response);
            
            var capture;
            response = doc.elementsByTagName( "rev" ).at( 0 ).toElement().text();
            
            if(capture = /<(lyrics?>)/i.exec(response))
            { // ok, lyrics found
                // lyrics can be between <lyrics></lyrics> or <lyric><lyric> tags
                // such variant can be in one response: <lyrics>national lyrics</lyrics> <lyrics>english lyrics</lyrics>
                // example: http://lyrics.wikia.com/api.php?action=query&prop=revisions&titles=Flёur:Колыбельная_для_Солнца&rvprop=content&format=xml
                // we can not use lazy regexp because qt script don't understand it
                // so let's extract lyrics with string functions
                
                var lindex = response.indexOf("<" + capture[1]) + capture[1].length + 1;
                var rindex = response.indexOf("</" + capture[1]);
                NEWXML = NEWXML.replace( "{lyrics}", Amarok.Lyrics.escape( response.substring(lindex, rindex) ) );
                Amarok.Lyrics.showLyrics( NEWXML );
            }
            else if(capture = /#redirect\s+\[\[(.+)\]\]/i.exec(response))
            { // redirect pragma found: #REDIRECT [[Band:Song]]
                redirects++;
                if(redirects == MAXREDIRECTS)
                { // redirection limit exceed
                    Amarok.Lyrics.showLyricsNotFound( ERRORMSG );
                    return;
                }
                
                var url = QUrl.fromEncoded( new QByteArray( WIKIAURL + encodeURIComponent( capture[1] ) ), 1);
                new Downloader( url, new Function("response", "onLyricsReceived(response, " + redirects + ")") );
            }
            else if(redirects < 0)
            { // if we get here after redirect than something go wrong, so checks that redirects < 0
              // maybe lyricwiki can help us
                var urlstr = "http://lyrics.wikia.com/api.php?action=lyrics&func=getSong&fmt=xml&artist=" + ARTIST + "&song=" + TITLE;
                var url = QUrl.fromEncoded( new QByteArray( urlstr ), 1 );
                new Downloader( url, onHelpReceived );
            }
            else
            {
                Amarok.Lyrics.showLyricsNotFound( ERRORMSG );
            }
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onLyricsReceived: " + err );
    }
}

/* This function tries to build an HTML formated page to show lyrics of songs tagged with GENRE = HINDI
   Note that it is two step process where in the first step it tries to get the ID of the song using search function and then the second
   step tries to fetch the song lyrics using that ID
*/
function onIndoLyricsReceived( response, redirects )
{
    try
    {
        if( response.length == 0 )
            Amarok.Lyrics.showLyricsError( "Unable to contact server - no website returned" ); // TODO: this should be i18n able
        else
        {
            response = response.replace( /##/g, "$" );               //convert double hashes
            var splice = response.match(/#indian([^#]*)#endindian/);
            var lyrics = RegExp.$1;
//Amarok.debug( lyrics );
            lyrics = convertHindi( lyrics );

            splice = response.match(/stitle\{([^\}]*)\}%/);
            var title = convertHindi( RegExp.$1 );
            splice = response.match(/film\{([^\}]*)\}%/);
            var album  = RegExp.$1;
            splice = response.match(/year\{([^\}]*)\}%/);
            var year   = RegExp.$1;
            splice = response.match(/singer\{([^\}]*)\}%/);
            var singer = RegExp.$1;
            splice = response.match(/music\{([^\}]*)\}%/);
            var composer = RegExp.$1;
            splice = response.match(/lyrics\{([^\}]*)\}%/);
            var lyricist = RegExp.$1;

            NEWHTML = HTML.replace( "{body}", BODY );
            NEWHTML = NEWHTML.replace( "{title}", Amarok.Lyrics.escape( title ) );
            NEWHTML = NEWHTML.replace( "{album}", Amarok.Lyrics.escape( album ) );
            if( year.length > 0 )
                NEWHTML = NEWHTML.replace( "{year}", "@ " + Amarok.Lyrics.escape( year ) );
            else {
                NEWHTML = NEWHTML.replace( "{year}", " " );
            }
            NEWHTML = NEWHTML.replace( "{composer}", Amarok.Lyrics.escape( composer ) );
            NEWHTML = NEWHTML.replace( "{singer}", Amarok.Lyrics.escape( singer ) );
            NEWHTML = NEWHTML.replace( "{lyricist}", Amarok.Lyrics.escape( lyricist ) );

            lyrics = Amarok.Lyrics.escape( lyrics )
            lyrics = lyrics.replace( /\n/g, "\<br /\>" );   //replace newlines with line breaks
            lyrics = lyrics.replace( /%/g, "" );            //remove remaining % marks
            NEWHTML = NEWHTML.replace( "{lyrics}", lyrics );
            NEWHTML = NEWHTML.replace( "{links}", "&copy; <a href='http://www.giitaayan.com/'>Giitaayan</a>" );
//Amarok.debug( NEWHTML );
            Amarok.Lyrics.showLyricsHtml( NEWHTML );
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onIndoLyricsReceived: " + err );
    }
}

function onIndoSearchResult( response, redirects )
{
    ITRANSURL = "http://thaxi.hsc.usc.edu/rmim/giitaayan/cisb";
    try
    {
        if( response.length == 0 )
            Amarok.Lyrics.showLyricsError( "Unable to contact server - no website returned" ); // TODO: this should be i18n able
        else
        {
//Amarok.debug( response );
            response = response.replace( /\n/g, "" ); // No need for LF, just complicates our RegExps
            response = response.replace( /\r/g, "" ); // No need for CR, just complicates our RegExps

            // Remove images, links, scripts, styles and fonts
            response = response.replace( /<[iI][mM][gG][^>]*>/g, "" );
            response = response.replace( /<[sS][cC][rR][iI][pP][tT][^>]*>[^<]*(<!--[^-]*-->)*[^<]*<\/[sS][cC][rR][iI][pP][tT]>/g, "" );
            response = response.replace( /<[sS][tT][yY][lL][eE][^>]*>[^<]*(<!--[^-]*-->)*[^<]*<\/[sS][tT][yY][lL][eE]>/g, "" );
            response = response.replace( /<[fF][oO][rR][mM][^>]*>[^<]*<\/[fF][oO][rR][mM]>/g, "" );
            if(capture = /Sorry, no/i.exec(response)) {
                Amarok.Lyrics.showLyricsError( "No song lyrics found." );
//Amarok.debug( "No song lyrics found." );
            }
            else {
                pick = response.match( /Total[\s*]<b>(\d+)<\/b>[\s*]songs/ );
                var maxno = parseInt( RegExp.$1 );                      //pick[0].match(/\d+/);
                if( isNaN( maxno ) ) {
                    Amarok.Lyrics.showLyricsError( "Script encountered some error." );
                    Amarok.debug( "Script encountered some error where MAXNO = NaN" );
                }
                else if( maxno == 1 ) {
                    var song_no = response.match(/\/\d+\.isb/);
                    var url = QUrl.fromEncoded( new QByteArray( ITRANSURL + song_no ), 1);
                    new Downloader( url, new Function("response", "onIndoLyricsReceived(response, -1)") );
                }
                else {
                    maxno = (maxno > 50 ? 50 : maxno );
                    var rows = response.split( "<table" )[2].split( "<tr>" );
                    var suggestion = "";
                    for( var i = 2; i < maxno + 2; i++ ) {
                        row = rows[i];
                        cells = row.split( "<td>" );
                        splice = cells[7].match( /">([^<]*[\/]*)<\// ); artist = RegExp.$1;
                        index = cells[3].indexOf( "</" );
                        title = cells[3].substring( 0, index );
                        url = cells[1].match( /http[a-zA-Z0-9:\/\.]*/ );
                        suggestion = suggestion + "<suggestion artist=\"" + artist + "\" title=\"" + convertHindi( title.replace( /##/g, "$") ) + "\" url=\"" + url + "\" />\n";
                        if( i == 51 ) {
                            suggestion = suggestion + "<suggestion artist=\"\" title=\"Please reduce the search results by using a longer song title.\" url=\"\" />\n";
                        }
                    }
                    NEWXML = "<suggestions page_url=\"\">\n" + suggestion + "\n</suggestions>";
//Amarok.debug( NEWXML );
                    Amarok.Lyrics.showLyrics( NEWXML );
                }
            }
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onIndoSearchResult: " + err );
    }
}

// build a URL component out of a string containing an artist or a song title
function URLify( string ) {
    try {
        // replace (erroneously used) accent ` with a proper apostrophe '
        string = string.replace( "`", "'" );
        // split into words, then treat each word separately
        var words = string.split( " " );
        for ( var i = 0; i < words.length; i++ ) {
            var upper = 1; // normally, convert first character only to uppercase, but:
            // if we have a Roman numeral (well, at least either of "ii", "iii"), convert all "i"s
            if ( words[i].charAt(0).toUpperCase() == "I" ) {
                // count "i" letters 
                while ( words[i].length > upper && words[i].charAt(upper).toUpperCase() == "I" ) {
                    upper++;
                }
            }
            // if the word starts with an apostrophe or parenthesis, the next character has to be uppercase
            if ( words[i].charAt(0) == "'" || words[i].charAt(0) == "(" ) {
                upper++;
            }
            // finally, perform the capitalization
            if ( upper < words[i].length ) {
                words[i] = words[i].substring( 0, upper ).toUpperCase() + words[i].substring( upper );
            } else {
                words[i] = words[i].toUpperCase();
            }
            // now take care of more special cases
            // names like "McSomething"
            if ( words[i].substring( 0, 2 ) == "Mc" ) {
                words[i] = "Mc" + words[i][2].toUpperCase() + words[i].substring( 3 );
            }
            // URI-encode the word
            words[i] = encodeURIComponent( words[i] );
        } 
        // join the words back together and return the result
        var result = words.join( "_" );
        return result;
    } catch ( err ) {
        Amarok.debug ( "script error in function URLify: " + err );
    } 
}

// convert all HTML entities to their applicable characters
function entityDecode(string)
{
    try
    {
        var convertxml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?><body><entity>" + string + "</entity></body>";
        var doc = new QDomDocument();
        if(doc.setContent(convertxml))
        { // xml is valid
            return doc.elementsByTagName( "entity" ).at( 0 ).toElement().text();
        }
        
        return string;
    }
    catch( err )
    {
        Amarok.debug( "script error in function entityDecode: " + err );
    }
}

// entry point
function getLyrics( artist, title, url )
{
    try
    {
        var genre = Amarok.Engine.currentTrack().genre.replace(/[\r\t\n]/g, "");
        if(genre.toUpperCase().substring(0, 5) == "HINDI")
        {
            TITLE = entityDecode(title);
            HTML = HTML.replace( "{TITLE}", TITLE );
            if( url.length > 0 ) { // fetch using URL
                var newurl = QUrl.fromEncoded( new QByteArray( url ), 1);
Amarok.debug( "request URL: " + newurl.toString() );
                new Downloader( newurl, new Function("response", "onIndoLyricsReceived(response, -1)") );
            }
            else {
                var newurl = GEETURL.replace( "#{title}", encodeURIComponent(title) );
                var url = QUrl.fromEncoded( new QByteArray( newurl ), 1);
Amarok.debug( "request URL: " + url.toString() );
                new Downloader( url, new Function("response", "onIndoSearchResult(response, -1)") );
                TITLE = " ";
            }
        }
        else
        {
            // save artist and title for later display now
            NEWXML = XML.replace( "{artist}", Amarok.Lyrics.escape( artist ) );
            NEWXML = NEWXML.replace( "{title}", Amarok.Lyrics.escape( title ) );
        
            // strip "featuring <someone else>" from the artist
            var strip = artist.toLowerCase().indexOf( " ft. ");
            if ( strip != -1 ) { artist = artist.substring( 0, strip ); }
            strip = artist.toLowerCase().indexOf( " feat. " );
            if ( strip != -1 ) { artist = artist.substring( 0, strip ); }
            strip = artist.toLowerCase().indexOf( " featuring " );
            if ( strip != -1 ) { artist = artist.substring( 0, strip ); }
        
            // URLify artist and title
            ARTIST = artist = URLify( entityDecode(artist) );
            TITLE  = title  = URLify( entityDecode(title) );

            // assemble the (encoded!) URL, build a QUrl out of it and dispatch the download request
            var url = QUrl.fromEncoded( new QByteArray( WIKIAURL + artist + ":" + title ), 1);
Amarok.debug( "request URL: " + url.toString() );
                                                                       // there was no redirections yet
            new Downloader( url, new Function("response", "onLyricsReceived(response, -1)") );
        }
    }
    catch( err )
    {
        Amarok.debug( "error: " + err );
    }
}

Amarok.Lyrics.fetchLyrics.connect( getLyrics );
