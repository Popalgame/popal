"""Deterministic next-step diagnosis from recorded evidence, never a likeness claim."""
import copy


def diagnose(report, evidence=None, camera=None, result=None):
    evidence=evidence or report.get('input_evidence') or {}
    camera=camera or {};result=result or {};findings=[]
    def finding(category,code,detail):findings.append({'category':category,'code':code,'detail':detail})
    unresolved=evidence.get('missing_regions',[])+evidence.get('low_coverage_regions',[])
    rejected={name:g.get('scanner',{}).get('boundary_evidence',{}).get('rejected_reasons',{})
              for name,g in evidence.get('regions',{}).items()}
    rejected={name:reasons for name,reasons in rejected.items() if reasons}
    if rejected:finding('evidence','ambiguous_boundaries_rejected',rejected)
    contextual={name:g.get('scanner',{}).get('boundary_evidence',{}).get('context_supported_samples',0)
                for name,g in evidence.get('regions',{}).items()}
    if any(contextual.values()):finding('evidence','chin_neck_contact_hypothesis',{'samples':contextual,
        'basis':'Measured arc, bilateral jaw attachment and narrower skin below; not verified anatomical identity.'})
    if unresolved:finding('evidence','unresolved_regions',unresolved)
    annotation_warnings={name:g.get('scanner',{}).get('boundary_evidence',{}).get('annotation_warning_samples',0)
                         for name,g in evidence.get('regions',{}).items()}
    if any(annotation_warnings.values()):finding('evidence','annotations_with_heuristic_warnings',annotation_warnings)
    stop=report.get('stop_reason','');status=report.get('status')
    camera_codes={'camera_required','camera_error','camera_source_mismatch','frame_mismatch','perspective_not_supported'}
    evidence_codes={'outline_missing','outline_incomplete','outline_coverage_low','partial_evidence_insufficient','anchors_missing'}
    if stop in camera_codes:finding('camera',stop,report.get('message'))
    if status=='blocked' and stop not in camera_codes|evidence_codes|{'constraints_lock_face'}:
        finding('input_contract',stop or 'unresolved_input',report.get('message'))
    if camera.get('method')=='fixed_orientation_alignment':
        finding('camera','orientation_is_source_prior',{'rms_px':camera.get('rms_px'),'rotation_estimated_from_reference':False})
    if stop=='constraints_lock_face':finding('constraints',stop,report.get('message'))
    support=report.get('control_support',[])
    locked=[c['name'] for c in support if not c['movable_vertices']]
    if locked:finding('constraints','fully_locked_controls',locked)
    tiny=[c for c in support if c['movable_vertices'] and c['max_projected_motion_px_per_unit']<.5]
    if tiny:finding('controls','subpixel_control_range',{'controls':tiny,
        'scope':'Per-unit projected vertex motion after protection; not proof that combined controls cannot change an edge.'})
    bridged={side:gaps for side,gaps in report.get('coverage',{}).get('interpolated_gaps_px',{}).items() if gaps}
    if bridged:finding('evidence','interpolated_gaps',{'rows_px':bridged,
        'basis':'Short unobserved gaps between fragments move with their neighbours; not measured or scored.'})
    reach=report.get('control_reach',{});reach_regions=reach.get('regions',{})
    locked_regions=reach.get('locked_by_protection',[])
    if locked_regions:finding('constraints','outline_locked_by_protection',{r:reach_regions[r]['categories'] for r in locked_regions})
    if reach.get('without_control'):finding('controls','regions_without_control',reach['without_control'])
    if reach.get('reach_below_error'):finding('controls','reach_below_observed_error',{r:{'max_reach_px':reach_regions[r]['max_reach_px'],
        'observed_mean_px':reach_regions[r]['observed_mean_px']} for r in reach['reach_below_error']})
    if reach.get('first_step_below_raster'):finding('controls','step_below_raster_resolution',{r:reach_regions[r]['first_step_motion_px']
        for r in reach['first_step_below_raster']})
    surface=report.get('surface_quality') or {}
    if surface.get('status')=='fail':finding('surface','surface_quality_failed',{'failures':surface['failures'],'metrics':surface['metrics']})
    search=result.get('search_diagnostics',{})
    counts=search.get('trial_reasons',{})
    constrained={key:counts[key] for key in ('displacement_limit','triangle_orientation','unobserved_outline_motion','edge_shear','surface_quality','region_regression') if counts.get(key)}
    if constrained:finding('constraints','rejected_search_trials',constrained)
    if search.get('controls_at_bounds'):finding('controls','controls_at_bounds',search['controls_at_bounds'])
    residual={name:g['after']['p95_px'] for name,g in report.get('regions',{}).items() if g.get('after') and not g.get('within_target')}
    if residual:finding('shape_or_controls','remaining_observed_error',{'p95_px':residual,'cause':'undetermined; camera, shape and evidence errors are not uniquely separable from one view'})
    if status in ('failed','rejected','cancelled','interrupted','stale'):
        action='stop_and_inspect';summary='Przebieg wymaga diagnozy błędu; korekta nie jest zatwierdzona.'
    elif stop=='camera_required' and 'chin' in unresolved and rejected.get('chin'):
        action='resolve_boundary_evidence';summary='Odrzucona granica brody nie dostarcza punktu do kamery. Najpierw rozstrzygnij dane referencji.'
    elif stop in camera_codes:
        action='resolve_camera_evidence';summary='Brak zgodnej kamery lub obserwacji do jej wyznaczenia.'
    elif stop=='constraints_lock_face':
        action='retain_constraints';summary='Blokady uniemożliwiają korektę; automat ich nie znosi.'
    elif status=='blocked' and stop not in evidence_codes:
        action='resolve_input_contract';summary='Najpierw rozwiąż zgłoszony problem źródła lub konfiguracji.'
    elif locked_regions and status in ('stalled','blocked',None):
        action='resolve_protection_conflict'
        summary=('Mierzony obrys regionów '+', '.join(locked_regions)+' tworzą wyłącznie wierzchołki chronione przez użytkownika; '
                 'automat nie znosi ochrony. Decyzja: zawęzić ochronę albo przyjąć brak korekty tych regionów.')
        if unresolved:summary+=' Dodatkowo brak danych: '+', '.join(unresolved)+'.'
    elif status=='blocked' or unresolved or rejected or any(annotation_warnings.values()):
        action='resolve_boundary_evidence';summary='Niepełne lub niejednoznaczne granice: zachowaj blokady i zweryfikuj dane przed silniejszą korektą.'
    elif status=='target_met':
        action='review_candidate';summary='Próg obserwowanego obrysu osiągnięty; podobieństwo 3D pozostaje niezatwierdzone.'
    else:
        action='review_shape_and_controls';summary='Pozostał błąd kształtu lub ograniczeń korekty; samo zwiększenie liczby iteracji nie ma uzasadnienia.'
    if surface.get('status')=='fail':
        summary+=' Powierzchnia 3D nie przeszła kontroli: '+', '.join(surface['failures'])+'; dopasowanie obrysu nie wystarcza.'
    if locked_regions and action!='resolve_protection_conflict':
        summary+=' Bez korekty z powodu ochrony użytkownika: '+', '.join(locked_regions)+'.'
    if any(contextual.values()):summary=f"Broda: kandydat styku z szyją ({sum(contextual.values())} próbek). "+summary
    return {'schema':'polpal.fit-diagnosis/1','status':status,'source_sha256':report.get('source_sha256',evidence.get('source_sha256')),
        'source_mesh_sha256':report.get('source_mesh_sha256'),'findings':findings,'next_action':action,'summary':summary,
        'automatic_retry':False,'search':copy.deepcopy(search),'likeness_approved':False,
        'scope':'Rule-based diagnosis of recorded checks; no inferred hidden anatomy or uniquely identified physical cause.'}
