'use strict';

var srlog = SIREPO.srlog;
var srdbg = SIREPO.srdbg;
SIREPO.DEFAULT_COLOR_MAP = 'viridis';

SIREPO.app.factory('vtkPlotting', function(appState, plotting, vtkService, panelState, utilities, $window) {

    var isPlottingReady = false;

    vtkService.vtk().then(function() {
        isPlottingReady = true;
    });

    function identityTransform(lpoint) {
        return lpoint;
    }

    function testTansformInverse(xform, invXform, lpoint) {
        var lpoint2 = invXform(xform(lpoint));
        if(lpoint2[0] != lpoint[0] || lpoint2[1] != lpoint[1] || lpoint2[2] != lpoint[2]) {
            throw 'transform(inverse) != identity:' + lpoint + '->' + lpoint2;
        }
    }

    return {

        vtkPlot: function(scope, element) {

            scope.element = element[0];
            var requestData = plotting.initAnimation(scope);

            scope.windowResize = utilities.debounce(function() {
                scope.resize();
            }, 250);

            scope.$on('$destroy', function() {
                scope.destroy();
                scope.element = null;
                $($window).off('resize', scope.windowResize);
            });

            scope.$on(
                scope.modelName + '.changed',
                function() {
                    scope.prevFrameIndex = -1;
                    if (scope.modelChanged) {
                        scope.modelChanged();
                    }
                    panelState.clear(scope.modelName);
                    requestData();
                });
            scope.isLoading = function() {
                return panelState.isLoading(scope.modelName);
            };
            $($window).resize(scope.windowResize);

            scope.init();
            if (appState.isLoaded()) {
                requestData();
            }
        },

        coordMapper: function(transform) {

            return {

                xform: transform || identityTransform,

                // These functions take an optional transformation to go from "lab"
                // coordinates to vtk screen coordinates
                setPlane: function(planeSource, lo, lp1, lp2) {
                    var vo = this.xform(lo);
                    var vp1 = this.xform(lp1);
                    var vp2 = this.xform(lp2);
                    planeSource.setOrigin(vo[0], vo[1], vo[2]);
                    planeSource.setPoint1(vp1[0], vp1[1], vp1[2]);
                    planeSource.setPoint2(vp2[0], vp2[1], vp2[2]);
                },
                buildBox: function(lsize, lcenter) {
                    var vsize = this.xform(lsize);
                    var vcenter = this.xform(lcenter);
                    return vtk.Filters.Sources.vtkCubeSource.newInstance({
                        xLength: vsize[0],
                        yLength: vsize[1],
                        zLength: vsize[2],
                        center: vcenter
                    });
                },
                buildLine: function(lp1, lp2, colorArray) {
                    var vp1 = this.xform(lp1);
                    var vp2 = this.xform(lp2);
                    var ls = vtk.Filters.Sources.vtkLineSource.newInstance({
                        point1: [vp1[0], vp1[1], vp1[2]],
                        point2: [vp2[0], vp2[1], vp2[2]],
                        resolution: 2
                    });

                    var lm = vtk.Rendering.Core.vtkMapper.newInstance();
                    lm.setInputConnection(ls.getOutputPort());

                    var la = vtk.Rendering.Core.vtkActor.newInstance();
                    la.getProperty().setColor(colorArray[0], colorArray[1], colorArray[2]);
                    la.setMapper(lm);
                    return la;
                },
                buildSphere: function(lcenter, radius, colorArray, transform) {
                    var vcenter = this.xform(lcenter);
                    var ps = vtk.Filters.Sources.vtkSphereSource.newInstance({
                        center: vcenter,
                        radius: radius,
                        thetaResolution: 16,
                        phiResolution: 16
                    });

                    var pm = vtk.Rendering.Core.vtkMapper.newInstance();
                    pm.setInputConnection(ps.getOutputPort());

                    var pa = vtk.Rendering.Core.vtkActor.newInstance();
                    pa.getProperty().setColor(colorArray[0], colorArray[1], colorArray[2]);
                    pa.getProperty().setLighting(false);
                    pa.setMapper(pm);
                    return pa;
                },
            };
        },

        // Takes a vtk sphere source and returns a box in viewport coordinates with a bunch of useful
        // geometric properties and methods
        // TODO (mvk): the whole thing
        vpBox: function(vtkCubeSource) {
        },

        addActors: function(renderer, actorArr) {
            for(var aIndex = 0; aIndex < actorArr.length; ++aIndex) {
                renderer.addActor(actorArr[aIndex]);
            }
        },
        removeActors: function(renderer, actorArr) {
            for(var aIndex = 0; aIndex < actorArr.length; ++aIndex) {
                renderer.removeActor(actorArr[aIndex]);
            }
        },
        showActors: function(renderWindow, actorArray, doShow, visibleOpacity, hiddenOpacity) {
            for(var aIndex = 0; aIndex < actorArray.length; ++aIndex) {
                actorArray[aIndex].getProperty().setOpacity(doShow ? visibleOpacity || 1.0 : hiddenOpacity || 0.0);
            }
            renderWindow.render();
        },

        // display values seem to be double, not sure why
        localCoordFromWorld: function (coord, point) {
            coord.setCoordinateSystemToWorld();
            coord.setValue(point);
            var lCoord = coord.getComputedLocalDisplayValue();
            return [lCoord[0] / 2.0, lCoord[1] / 2.0];
        },
        worldCoordFromLocal: function (coord, point, view) {
            var newPoint = [2.0 * point[0], 2.0 * point[1]];
            // must first convert from "localDisplay" to "display"  - this is the inverse of
            // what is done by vtk to get from display to localDisplay
            var newPointView = [newPoint[0], view.getFramebufferSize()[1] - newPoint[1] - 1];
            coord.setCoordinateSystemToDisplay();
            coord.setValue(newPointView);
            return coord.getComputedWorldValue();
        },

    };
});
