define(['dojo/_base/declare',
        'dojo/_base/array',
        'dojo/dom-construct',
        'JBrowse/Util',
        'dijit/form/TextBox',
        'dijit/form/Select',
        'dijit/form/Button',
        'JBrowse/View/TrackConfigEditor'
       ],
       function(
           declare,
           array,
           dom,
           Util,
           TextBox,
           Select,
           Button,
           TrackConfigEditor
       ) {

var uniqCounter = 0;

return declare( null, {

constructor: function( args ) {
    this.browser = args.browser;
    this.fileDialog = args.fileDialog;
    this.domNode = dom.create('div', { className: 'trackList', innerHTML: 'track list!' });

    this._updateDisplay();
},


getTrackConfigurations: function() {
    return Util.dojof.values( this.trackConfs || {} );
},

update: async function( resources ) {
    this.storeConfs = {};
    this.trackConfs = {};

    await this._makeStoreConfs( resources );

    // make some track configurations from the store configurations
    await this._makeTrackConfs();

    this._updateDisplay();
},

_makeStoreConfs: async function( resources ) {
    // when called, rebuild the store and track configurations that we are going to add
    this.storeConfs = this.storeConfs || {}

    let typeDrivers = this.fileDialog.getFileTypeDrivers()

    // anneal the given resources into a set of data store
    // configurations by offering each file to each type driver in
    // turn until no more are being accepted
    let lastLength = 0;
    while(resources.length && resources.length != lastLength) {

        resources = resources.filter( resource =>
            ! typeDrivers.some( drv => drv.tryResource( this.storeConfs, resource ))
        )

        lastLength = resources.length
    }

    typeDrivers.forEach(drv => drv.finalizeConfiguration(this.storeConfs))

    if( resources.length )
        console.warn( "Not all resources could be assigned to tracks. Unused resources:", resources );
},

_makeTrackConfs: async function() {
    // object that maps store type -> default track type to use for the store
    var typeMap = this.browser.getTrackTypes().trackTypeDefaults;

    // find any store configurations that appear to be coverage stores
    var coverageStores = {};
    for( var n in this.storeConfs ) {
        if( this.storeConfs[n].fileBasename ) {
            var baseBase = this.storeConfs[n].fileBasename.replace(/\.(coverage|density|histograms?)$/,'');
            if( baseBase != this.storeConfs[n].fileBasename ) {
                coverageStores[baseBase] = { store: this.storeConfs[n], name: n, used: false };
            }
        }
    }

    // make track configurations for each store configuration
    for( var n in this.storeConfs ) {
        var store = this.storeConfs[n];
        var trackType = typeMap[store.type] || 'JBrowse/View/Track/CanvasFeatures';

        this.trackConfs = this.trackConfs || {};

        this.trackConfs[ n ] =  {
            store: this.storeConfs[n],
            label: n,
            key: n.replace(/_\d+$/,'').replace(/_/g,' '),
            type: trackType,
            category: "Local tracks",
            autoscale: "local" // make locally-opened BigWig tracks default to local autoscaling
        };

        // if we appear to have a coverage store for this one, use it
        // and mark it to have its track removed after all the tracks are made
        var cov = coverageStores[ store.fileBasename ];
        if( cov ) {
            this.trackConfs[n].histograms = {
                store: cov.store,
                description: cov.store.fileBasename
            };
            cov.used = true;
        }
    }

    // delete the separate track confs for any of the stores that were
    // incorporated into other tracks as histograms
    for( var n in coverageStores ) {
        if( coverageStores[n].used )
            delete this.trackConfs[ coverageStores[n].name ];
    }
},

_delete: function( trackname ) {
    delete (this.trackConfs||{})[trackname];
    this._updateDisplay();
},

_updateDisplay: function() {
    var that = this;

    // clear it
    dom.empty( this.domNode );

    dom.create('h3', { innerHTML: 'New Tracks' }, this.domNode );

    if( ! Util.dojof.keys( this.trackConfs||{} ).length ) {
        dom.create('div', { className: 'emptyMessage',
                            innerHTML: 'None'
                          },this.domNode);
    } else {
        var table = dom.create('table', { innerHTML: '<tr class="head"><th>Name</th><th>Display</th><th></th></tr>'}, this.domNode );

        var trackTypes = this.browser.getTrackTypes();

        for( var n in this.trackConfs ) {
            var t = this.trackConfs[n];
            var r = dom.create('tr', {}, table );
            new TextBox({
                value: t.key,
                onChange: function() { t.key = this.get('value'); }
            }).placeAt( dom.create('td',{ className: 'name' }, r ) );
            new Select({
                    options: array.map( trackTypes.knownTrackTypes, function( t ) {
                                            var l = trackTypes.trackTypeLabels[t]
                                                || t.replace('JBrowse/View/Track/','').replace(/\//g, ' ');
                                            return { label: l, value: t };
                                        }),
                    value: t.type,
                    onChange: function() {
                        t.type = this.get('value');
                    }
            }).placeAt( dom.create('td',{ className: 'type' }, r ) );

            new Button({
               className: 'edit',
               title: 'edit configuration',
               innerHTML: 'Edit Configuration',
               onClick: (function(track) {
                   return function() {
                       new TrackConfigEditor( track )
                           .show( function( result) {
                                dojo.mixin( track, result.conf );
                                that._updateDisplay();
                           });
                   }
               })(t)
            }).placeAt( dom.create('td', { className: 'edit' }, r ) );

            dojo.create('td',{
                  width: '1%',
                  innerHTML: '<div class="dijitIconDelete"></div>',
                  onclick: function(e) {
                      e.preventDefault && e.preventDefault();
                      that._delete( n );
                  }
                }, r);

            dom.create('td',{ className: 'type' }, r );
        }
    }
}

});
});

