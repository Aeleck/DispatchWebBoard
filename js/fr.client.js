var fr = fr !== undefined ? fr : {};
var debug = debug !== undefined ? debug : true;

function getTimeSpan(date1, date2) {
    return Math.round(date1 / 1000) - Math.round(date2 / 1000);
}

fr.client = {
    cId: (debug ? "95a43559-69c3-40a6-86bb-f97d5d028e5e" : "6ae5920a-8764-4338-9877-aa4d9f851e0e"),
	currentToken: null,
	CookieBase: 'fr_db_',
    CachedRescues: {},
    CachedRats: {},
    SelectedRescue: null,
	init: function() {
        if (debug) console.log("fr.client.init - fr.Client loaded. DEBUG MODE ACTIVE.");
        fr.client.RequestRescueList();
        fr.client.UpdateClock();
        window.onpopstate = fr.client.HandlePopState;
	},
	GetCookie: function(name) {
        try {
            var cookie = document.cookie;
            name = fr.client.CookieBase + name;
            var valueStart = cookie.indexOf(name + "=") + 1;
            if (valueStart === 0) {
                return null;
            }
            valueStart += name.length;
            var valueEnd = cookie.indexOf(";", valueStart);
            if (valueEnd == -1)
                valueEnd = cookie.length;
            return decodeURIComponent(cookie.substring(valueStart, valueEnd));
        } catch (e) {
        }
        return null;
    },
    SetCookie: function(name, value, expire) {
        var temp = fr.client.CookieBase + name + "=" + escape(value) + (expire !== 0 ? "; path=/; expires=" + ((new Date((new Date()).getTime() + expire)).toUTCString()) + ";" : "; path=/;");
        document.cookie = temp;
    },
    CanSetCookies: function() {
        SetCookie('CookieTest', 'true', 0);
        var can = GetCookie('CookieTest') !== null;
        DelCookie('CookieTest');
        return can;
    },
    DelCookie: function(name) {
        document.cookie = fr.client.CookieBase + name + '=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    },
    HandleTPA: function (tpa) {
        if(debug) console.log("fr.client.HandleTPA - New TPA");
        if(debug) console.log(tpa);
        switch (tpa.meta.action) {
            case 'rescues:read':
                for (var i in tpa.data)
                    fr.client.AddRescue(tpa.data[i]);
                fr.client.ParseQueryString();
                break;
            case 'rescue:created':
                fr.client.AddRescue(tpa.data);
                break;
            case 'rescue:updated':
                fr.client.UpdateRescue(tpa.data);
                break;
            case 'rats:read':
                fr.client.UpdateRats(tpa);
                break;
            case 'welcome':
            case 'stream:subscribe':
                break;
            default:
                console.log("Unhandled TPA: " + tpa);
                break;
        }
          
    },
    RequestRescueList: function () {
        fr.ws.send('rescues:read', { 'open': 'true' });
        var rTable = $('<table id="rescueTable" class="table table-striped table-bordered"></table>');
        var rHead = $('<thead><th>Case #</th><th>CMDR Name</th><th>System</th><th>Rats</th><th width="45px"></th></thead>');
        rTable.append(rHead);
        $('#columnBoard').empty().append(rTable);
    },
    FetchRatInfo: function (ratId) {
        if (fr.client.CachedRats[ratId]) {
            if(debug) console.log("fr.client.FetchRatInfo - Cached Rat Requested: ");
            if(debug) console.log(fr.client.CachedRats[ratId]);
            return fr.client.CachedRats[ratId];
        } else {
            if(debug) console.log("fr.client.FetchRatInfo - Gathering RatInfo: " + ratId);
            fr.ws.send('rats:read', { 'id': ratId }, { 'searchId': ratId });
            return null;
        }
    },
    UpdateRats: function (tpa) {
        var rat = $('.rat-' + tpa.meta.searchId);
        if (tpa.data.length > 0) {
            if(!fr.client.CachedRats[tpa.data[0].id]) {
                if(debug) console.log("fr.client.UpdateRats - Caching RatInfo:  " + tpa.data[0].id + " : " + tpa.data[0].CMDRname);
                fr.client.CachedRats[tpa.data[0].id] = tpa.data[0];
            }
            rat.text(tpa.data[0].CMDRname);
        } else {
            rat.html('<i>Not found</i>');
        }
    },
    ParseQueryString: function () {
        var ar = $.getUrlParam("ar");
        if(ar && fr.client.CachedRescues[ar]) {
            fr.client.SetSelectedRescue(ar, true);
        }
    },
    HandlePopState: function (event) {
        fr.client.SetSelectedRescue(event.state.ar, true);
    },
    AddRescue: function (tpa) {
        if(!tpa) return;

        var table = $('#rescueTable');
        var rescue = tpa;

        if ($('#rescue-' + rescue.id).length > 0) {
            fr.client.UpdateRescue(tpa);
            return;
        }

        var rats = rescue.rats;
        var ratHtml = [];
        
        for (var r in rats) {
            var rInfo = fr.client.FetchRatInfo(rats[r]);
            ratHtml.push('<span class="rat-' + rats[r] + '">' + (rInfo ? rInfo.CMDRname : '<i>Loading</i>') + '</span>');
        }
        
        var row = $(
        '<tr id="rescue-' + rescue.id + '">' +
            '<td>' + (rescue.data ? rescue.data.boardIndex ? rescue.data.boardIndex : 'X' : 'X') + '</td>' +
            '<td title="' + (rescue.data ? rescue.data.IRCNick ? 'Nick: ' + rescue.data.IRCNick : '' : '') + '">' + (rescue.client ? rescue.client : '') + ' <span class="rescue-platform">' + (rescue.platform ? rescue.platform.toUpperCase() : '') + '</span></td>' +
            '<td>' + (rescue.system ? rescue.system : 'unknown') + '</td>' +
            '<td>' + ratHtml.join(', ') + '</td>' +
            '<td onClick="javascript:fr.client.SetSelectedRescue(\'' + rescue.id + '\',false)"><button id="detailBtn-'+rescue.id+'" type="button" class="btn btn-default btn-xs btn-fr-detail"><span class="glyphicon glyphicon-info-sign"></span></button></td>' +
        '</tr>'
        );

        if (rescue.epic) {
            row.addClass('rescue-epic');
        } else {
            row.removeClass('rescue-epic');
        }

        if (rescue.codeRed) {
            row.addClass('rescue-codered');
        } else {
            row.removeClass('rescue-codered');
        }

        if (!rescue.active) {
            row.addClass('rescue-inactive');
        } else {
            row.removeClass('rescue-inactive');
        }

        var notes = rescue.quotes.join('\n');
        row.attr('title', notes);
        if(debug) console.log("fr.client.AddRescue: Rescue Added to board.");
        fr.client.CachedRescues[rescue.id] = rescue;
        table.append(row);  
    },
    UpdateRescue: function (tpa) {
        if(!tpa) return;

        var rescueRow = $('#rescue-' + tpa.id);
        var rescue = tpa;

        var rats = rescue.rats;
        var ratHtml = [];
            
        for (var r in rats) {
            var rInfo = fr.client.FetchRatInfo(rats[r]);
            ratHtml.push('<span class="rat-' + rats[r] + '">' + (rInfo ? rInfo.CMDRname : '<i>Loading</i>') + '</span>');
        }  

        rescueRow.html(
            '<td>' + (rescue.data ? rescue.data.boardIndex ? rescue.data.boardIndex : 'X' : 'X') + '</td>' +
            '<td title="' + (rescue.data ? rescue.data.IRCNick ? 'Nick: ' + rescue.data.IRCNick : '' : '') + '">' + (rescue.client ? rescue.client : '') + ' <span class="rescue-platform">' + (rescue.platform ? rescue.platform.toUpperCase() : '') + '</span></td>' +
            '<td>' + (rescue.system ? rescue.system : 'unknown') + '</td>' +
            '<td>' + ratHtml.join(', ') + '</td>' +
            '<td onClick="javascript:fr.client.SetSelectedRescue(\'' + rescue.id + '\',false)"><button id="detailBtn-'+rescue.id+'" type="button" class="btn btn-default btn-xs btn-fr-detail"><span class="glyphicon glyphicon-info-sign"></span></button></td>' +
            '</td>');
        
        if (rescue.epic) {
            rescueRow.addClass('rescue-epic');
        } else {
            rescueRow.removeClass('rescue-epic');
        }

        if (rescue.codeRed) {
            rescueRow.addClass('rescue-codered');
        } else {
            rescueRow.removeClass('rescue-codered');
        }

        if (!rescue.active) {
            rescueRow.addClass('rescue-inactive');
        } else {
            rescueRow.removeClass('rescue-inactive');
        }

        var notes = rescue.quotes.join('\n');
        rescueRow.attr('title', notes);

        rescueRow.animate({
            opacity: 0.3
        }, 500).animate({
            opacity: 1
        }, 500);

        if (!rescue.open) {
            setTimeout(function () { rescueRow.hide('slow').remove(); }, 5000);
            if(debug) console.log("fr.client.UpdateRescue - Rescue Removed: " + rescue.id + " : " + rescue.client);
            delete fr.client.CachedRescues[rescue.id];
            return;
        }

        if(debug) console.log("fr.client.UpdateRescue - Rescue Updated: " + rescue.id + " : " + rescue.client);
        fr.client.CachedRescues[rescue.id] = rescue;
        if(tpa.id === fr.client.SelectedRescue.id) {
            if(debug) console.log("fr.client.UpdateRescue - Rescue DetailView Updating: " + rescue.id + " : " + rescue.client);
            fr.client.SelectedRescue = rescue;
            fr.client.UpdateRescueDetail();
        }
    },
    UpdateClock: function () {
        var nowTime = new Date();

        var edTime = (nowTime.getUTCFullYear() + 1286) +
           '-' + ((nowTime.getUTCMonth() + 1)    < 10 ? '0' : '') + (nowTime.getUTCMonth() + 1) +
           '-' + (nowTime.getUTCDate()     < 10 ? '0' : '') + nowTime.getUTCDate()    +
           ' ' + (nowTime.getUTCHours()    < 10 ? '0' : '') + nowTime.getUTCHours()   +
           ':' + (nowTime.getUTCMinutes()  < 10 ? '0' : '') + nowTime.getUTCMinutes() +
           ':' + (nowTime.getUTCSeconds()  < 10 ? '0' : '') + nowTime.getUTCSeconds();

        $('.ed-clock').text(edTime);
        setTimeout(fr.client.UpdateClock, 500);
    },
    RescueClockTimeoutID: null,
    UpdateRescueClock: function () {
        if(fr.client.SelectedRescue !== null) {
            var secondsElapsed = getTimeSpan(Date.now(),Date.parse(fr.client.SelectedRescue.createdAt));
            var seconds = secondsElapsed % 60;
            secondsElapsed -= seconds;
            var minutes = Math.floor(secondsElapsed / 60) % 60;
            secondsElapsed -= (minutes * 60);
            var hours   = Math.floor(secondsElapsed / 3600);

            var tstr = (hours   < 10 ? '0' : '') + hours + 
                 ':' + (minutes < 10 ? '0' : '') + minutes + 
                 ':' + (seconds < 10 ? '0' : '') + seconds;
            $('.rdetail-timer').text(tstr);
        }
    },
    SetSelectedRescue: function (key, preventPush) {
        if(key === null || (fr.client.SelectedRescue && key === fr.client.SelectedRescue.id)) {
            fr.client.SelectedRescue = null;
            if(fr.client.RescueClockTimeoutID !== null) {
                window.clearInterval(fr.client.RescueClockTimeoutID);
                fr.client.RescueClockTimeoutID = null;
            }
            if(history.pushState && !preventPush) {
                var url = window.location.protocol+ '//' + window.location.host + window.location.pathname;
                window.history.pushState({"ar":null},'', url);
            }
            fr.client.UpdateRescueDetail();
            return;
        }
        if(fr.client.CachedRescues[key] === null) {
            console.log("SetSelectedRescue - invalid key: " + key);
            return;
        }
        if(debug) console.log("SetSelectedRescue - New SelectedRescue: " + fr.client.CachedRescues[key].id);
        if(fr.client.RescueClockTimeoutID === null) fr.client.RescueClockTimeoutID = window.setInterval(fr.client.UpdateRescueClock, 500);
        fr.client.SelectedRescue = fr.client.CachedRescues[key];
        if(history.pushState && !preventPush) {
            var url = window.location.protocol+ '//' + window.location.host + window.location.pathname + '?ar=' + encodeURIComponent(key);
            window.history.pushState({"ar":key},'', url);
        }
        fr.client.UpdateRescueDetail();
    },
    UpdateRescueDetail: function () {
        $('.btn-fr-detail.active').removeClass('active').removeClass('btn-info').addClass('btn-default');     // clear active buttons.

        if (!fr.client.SelectedRescue) {
            $('#columnDetail').addClass('fr-hidden');
            return;
        }
        var rescue = fr.client.SelectedRescue;

        var detailContent = '<div class="rdetail-header">' +
                              '<div class="rdetail-title">' + (rescue.data ? rescue.data.boardIndex ? '#' + rescue.data.boardIndex + ' - '  : '' : '') + (rescue.title ? rescue.title : rescue.client) + (rescue.codeRed ? ' <span class="label label-danger">Code Red</span>' : '') + (rescue.active ? '' : ' <span class="label label-warning">Inactive</span>') + '</div>' +
                              '<div class="rdetail-timer">00:00:00</div>' +
                            '</div>' +
                            '<table class="rdetail-body table table-rescue">' +
                                '<thead><td width="90px"></td><td></td></thead>' +
                                '<tbody>' +
                                    (rescue.data ? rescue.data.IRCNick ? '<tr class="rdetail-info"><td class="rdetail-info-title">IRC Nick</td><td class="rdetail-info-value">' + rescue.data.IRCNick + '</td></tr>' : '' : '') +
                                    (rescue.system                     ? '<tr class="rdetail-info"><td class="rdetail-info-title">System</td><td class="rdetail-info-value">' + rescue.system + '</td></tr>' : '') +
                                    (rescue.platform                   ? '<tr class="rdetail-info"><td class="rdetail-info-title">Platform</td><td class="rdetail-info-value">' + rescue.platform.toUpperCase() + '</td></tr>' : '') +
                                    (rescue.data ? rescue.data.langID  ? '<tr class="rdetail-info"><td class="rdetail-info-title">Language</td><td class="rdetail-info-value">' + rescue.data.langID.toUpperCase() + '</td></tr>' : '' : '') +
                                                                         '<tr class="rdetail-info"><td class="rdetail-info-title">UUID</td><td class="rdetail-info-value">' + rescue.id + '</td></tr>' +
                                                                         '<tr class="rdetail-info-seperator"><td class="tbl-border-none"></td><td></td></tr>';
        // Rats
        var ratHtml = [];
        for (var rat in rescue.rats) {
            var rInfo = fr.client.FetchRatInfo(rescue.rats[rat]);
            ratHtml.push('<span class="rat-' + rescue.rats[rat] + '">' + (rInfo !== null ? rInfo.CMDRname : '<i>Loading</i>') + '</span>');
        }
        for (var uRat in rescue.unidentifiedRats) {
            ratHtml.push('<span class="rat-unidentified">' + rescue.unidentifiedRats[uRat] + '</span> <span class="label label-warning">unidentified</span>');
        }

        detailContent += '<tr class="rdetail-info"><td class="rdetail-info-title">Rats</td><td class="rdetail-info-value tbl-border-box">' + (ratHtml.length > 0 ? ratHtml[0] : '<i>Unassigned</i>') + '</td></tr>';
        if(ratHtml.length > 1)
            for(var i = 1 ; i < ratHtml.length ; i++)
                detailContent +='<tr class="rdetail-info"><td class="rdetail-info-empty"></td><td class="rdetail-info-value tbl-border-box">' + ratHtml[i] + '</td></tr>';

        detailContent += '<tr class="rdetail-info-seperator"><td class="tbl-border-none"></td><td></td></tr>'; // Separator

        // Quotes
        detailContent += '<tr class="rdetail-info"><td class="rdetail-info-title">Quotes</td><td class="rdetail-info-value tbl-border-box">' + (rescue.quotes.length > 0 ? rescue.quotes[0] : '<i>None</i>') + '</td></tr>';
        if(rescue.quotes.length > 1)
            for(var i = 1 ; i < rescue.quotes.length ; i++)
                detailContent +='<tr class="rdetail-info"><td class="rdetail-info-empty"></td><td class="rdetail-info-value tbl-border-box">' + rescue.quotes[i] + '</td></tr>';

        //update the detail section.
        if(debug) console.log("fr.client.UpdateRescueDetail - Rescue DetailView Updated: " + rescue.id + " : " + rescue.client);
        $('#columnDetail').removeClass('fr-hidden');
        $('#rescueDetail').animate({opacity: 0.2}, 100).html(detailContent).animate({opacity: 1}, 500);

        $('#detailBtn-'+rescue.id).addClass('active').addClass('btn-info').removeClass('btn-default'); // Set new active button.
    }
};